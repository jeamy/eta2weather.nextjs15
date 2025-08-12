import Diff from "@/reader/functions/Diff";
import { ConfigState } from "@/redux/configSlice";
import { WifiAF83State } from "@/redux/wifiAf83Slice";
import { EtaApi } from '@/reader/functions/EtaApi';
import { EtaConstants, Names2Id } from "@/reader/functions/types-constants/Names2IDconstants";
import { EtaPos } from "@/reader/functions/types-constants/EtaConstants";
import { API } from '@/constants/apiPaths';

type EtaValues = {
    einaus: string;
    schaltzustand: string;
    heizentaste: string;
    kommentaste: string;
    tes: number;
    tea: number;
};

type TempDiff = {
    diff: number | null;
    twa: number;
    twi: number;
};

export function calculateNewSliderPosition({ einaus, schaltzustand, heizentaste, kommentaste }: EtaValues, diff: number): string {

    //    console.log(`
    //      Einaus: ${einaus}
    //      Schaltzustand: ${schaltzustand}
    //      Kommenttaste: ${kommenttaste}
    //      Diff: ${diff}
    //    `);
    return (einaus === "Aus" || (schaltzustand === "Aus" && (heizentaste === "Aus" || kommentaste === "Aus")))
        ? "0.0"
        : new Diff().getDiff(diff, 1.25, 5.0, 0.0, 100.0).toString();
}

export function calculateTemperatureDiff(config: ConfigState, wifiAf83Data: WifiAF83State): { diff: number | null; twa: number; twi: number } {
    //    console.log('calculatingTemperature diff...', wifiAf83Data);

    const twi = wifiAf83Data.data.indoorTemperature;
    const twa = wifiAf83Data.data.temperature ?? 0;
    const { t_soll, t_delta } = config.data;

    /*    
        console.log(`
          Außentemperatur: ${twa}
          Innentemperatur: ${twi}
          Solltemperatur: ${t_soll}
          Deltatemperatur: ${t_delta}
        `);
    */

    const tSollNum = Number(t_soll);
    const tDeltaNum = Number(t_delta);

    if (isNaN(tSollNum) || isNaN(tDeltaNum) || isNaN(twi)) {
        console.error('Invalid temperature values:', { t_soll, t_delta, twi });
        return { diff: null, twa, twi };
    }

    const diff = Math.min(tSollNum + tDeltaNum - twi, 5.0);
//    console.log(`Diff calculation: ${tSollNum} + ${tDeltaNum} - ${twi} = ${diff}`);
    return { diff: Number(diff.toFixed(1)), twa, twi };
}

export function calculateMinTempDiff(indoorTemp: number, minTemp: string): number {
    const minTempNum = Number(minTemp);
    if (isNaN(minTempNum) || isNaN(indoorTemp)) {
        console.error('Invalid temperature values:', { indoorTemp, minTemp });
        return 0;
    }
    return Number((indoorTemp - minTempNum).toFixed(1));
}

export interface EtaApiInterface {
    setUserVar: (id: string, value: string, flags: string, index: string) => Promise<void>;
}

export async function updateSliderPosition(
    newPosition: number,
    currentPosition: number,
    names2id: Names2Id,
    etaApi: EtaApi,
): Promise<{ success: boolean; position: number; error?: string }> {
    // Set the new position
    const id = names2id[EtaConstants.SCHIEBERPOS]?.['id'];
    if (!id) {
        return {
            success: false,
            position: currentPosition,
            error: `Keine ID gefunden für shortkey: ${EtaConstants.SCHIEBERPOS}`
        };
    }

    const scaledPosition = (newPosition * 10).toString();
    console.log(`Setting slider position to: ${scaledPosition}`);
    try {
        // Set the new position using the API route
        const response = await fetch(API.ETA_UPDATE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id,
                value: scaledPosition,
                begin: "0",
                end: "0"
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update slider position');
        }

        const data = await response.json();
        return {
            success: true,
            position: newPosition
        };
    } catch (error) {
        console.error('Error setting slider position:', error);
        return {
            success: false,
            position: currentPosition,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}

export async function updateHeating(
    ht: number,
    auto: number,
    ab: number,
    kom: number,
    ge: number,
    names2id: Names2Id,
    etaApi: EtaApi,
): Promise<{ success: boolean; error?: string }> {
    // Set the new position
    const idht = names2id[EtaConstants.HEIZENTASTE]?.['id'];
    const idkom = names2id[EtaConstants.KOMMENTASTE]?.['id'];
    const idauto = names2id[EtaConstants.AUTOTASTE]?.['id'];
    const idge = names2id[EtaConstants.GEHENTASTE]?.['id'];
    const idab = names2id[EtaConstants.ABSENKTASTE]?.['id'];

    if (!idht) {
        return {
            success: false,
            error: `Keine ID gefunden für shortkey: ${EtaConstants.HEIZENTASTE}`
        };
    }
    if (!idkom) {
        return {
            success: false,
            error: `Keine ID gefunden für shortkey: ${EtaConstants.KOMMENTASTE}`
        };
    }
    if (!idauto) {
        return {
            success: false,
            error: `Keine ID gefunden für shortkey: ${EtaConstants.AUTOTASTE}`
        };
    }
    if (!idge) {
        return {
            success: false,
            error: `Keine ID gefunden für shortkey: ${EtaConstants.GEHENTASTE}`
        };
    }
    if (!idab) {
        return {
            success: false,
            error: `Keine ID gefunden für shortkey: ${EtaConstants.ABSENKTASTE}`
        };
    }

    console.log(`
      ht: ${ht} ${names2id[EtaConstants.HEIZENTASTE]?.['id']}
      auto: ${auto} ${names2id[EtaConstants.AUTOTASTE]?.['id']}
      ab: ${ab} ${names2id[EtaConstants.ABSENKTASTE]?.['id']}
      kom: ${kom} ${names2id[EtaConstants.KOMMENTASTE]?.['id']}
      ge: ${ge} ${names2id[EtaConstants.GEHENTASTE]?.['id']}
    `);

    try {
        // Set the new heating using the API route
        const rht = await fetch(API.ETA_UPDATE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: idht,
                value: ht == 1 ? EtaPos.EIN : EtaPos.AUS,
                begin: "0",
                end: "0"
            })
        });

        if (!rht.ok) {
            const error = await rht.json();
            throw new Error(error.error || 'Failed to update heating position');
        }

        const rkom = await fetch(API.ETA_UPDATE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: idkom,
                value: kom == 1 ? EtaPos.EIN : EtaPos.AUS,
                begin: "0",
                end: "0"
            })
        });

        if (!rkom.ok) {
            const error = await rkom.json();
            throw new Error(error.error || 'Failed to update kommen position');
        }

        const rauto = await fetch(API.ETA_UPDATE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: idauto,
                value: auto == 1 ? EtaPos.EIN : EtaPos.AUS,
                begin: "0",
                end: "0"
            })
        });

        if (!rauto.ok) {
            const error = await rauto.json();
            throw new Error(error.error || 'Failed to update auto position');
        }

        const rge = await fetch(API.ETA_UPDATE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: idge,
                value: ge == 1 ? EtaPos.EIN : EtaPos.AUS,
                begin: "0",
                end: "0"
            })
        });

        if (!rge.ok) {
            const error = await rge.json();
            throw new Error(error.error || 'Failed to update gehen position');
        }

        const rab = await fetch(API.ETA_UPDATE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: idab,
                value: ab == 1 ? EtaPos.EIN : EtaPos.AUS,
                begin: "0",
                end: "0"
            })
        });

        if (!rab.ok) {
            const error = await rab.json();
            throw new Error(error.error || 'Failed to update ab position');
        }

        return {
            success: true,
        };        
    } catch (error) {
        console.error('Error setting positions:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}
