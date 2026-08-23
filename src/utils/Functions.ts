import Diff from "@/reader/functions/Diff";
import { ConfigState } from "@/redux/configSlice";
import { WifiAF83State } from "@/redux/wifiAf83Slice";
import { EtaApi } from '@/reader/functions/EtaApi';
import { EtaConstants, Names2Id } from "@/reader/functions/types-constants/Names2IDconstants";
import { API } from '@/constants/apiPaths';
import { TEMP_CALC_CONSTANTS } from '@/reader/functions/types-constants/ConfigConstants';

type EtaValues = {
    einaus: string;
    schaltzustand: string;
    heizentaste: string;
    kommentaste: string;
    tes: number;
    tea: number;
    vorlauftemp?: number;
};

export function calculateNewSliderPosition({ einaus, schaltzustand, heizentaste, kommentaste, vorlauftemp }: EtaValues, diff: number): { base: string; final: string } {

    //    console.log(`
    //      Einaus: ${einaus}
    //      Schaltzustand: ${schaltzustand}
    //      Kommenttaste: ${kommentaste}
    //      Diff: ${diff}
    //    `);
    const overridesActive = heizentaste === "Ein" || kommentaste === "Ein";
    const heatingDisabled = einaus === "Aus" || (schaltzustand === "Aus" && !overridesActive);

    if (heatingDisabled) {
        return { base: "0.0", final: "0.0" };
    }

    const basePosition = new Diff().getDiff(diff, 1.25, 5.0, 0.0, 100.0);

    // Negative Sliderpositionen dürfen nicht durch vorlaufFactor verändert werden
    if (basePosition < 0) {
        const negValue = basePosition.toFixed(1);
        return { base: negValue, final: negValue };
    }

    const vorlaufFactor = (() => {
        const maxTemp = TEMP_CALC_CONSTANTS.VORLAUF_FACTOR_MAX_TEMP;
        if (vorlauftemp === undefined || vorlauftemp === null || isNaN(vorlauftemp)) {
            return 1;
        }
        if (vorlauftemp <= 38) {
            return 1;
        }
        if (vorlauftemp >= maxTemp) {
            return 0;
        }
        return (maxTemp - vorlauftemp) / (maxTemp - 38);
    })();

    const scaledPosition = Math.max(0, Math.min(100, basePosition * vorlaufFactor));
    return {
        base: basePosition.toFixed(1),
        final: scaledPosition.toFixed(1)
    };
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

    const diff = Math.min(tSollNum + tDeltaNum / TEMP_CALC_CONSTANTS.DELTA_DAMPENING_FACTOR - twi, 5.0);
//    console.log(`Diff calculation: ${tSollNum} + ${tDeltaNum}/${TEMP_CALC_CONSTANTS.DELTA_DAMPENING_FACTOR} - ${twi} = ${diff}`);
    return { diff: Number(diff.toFixed(2)), twa, twi };
}

export function calculateMinTempDiff(indoorTemp: number, minTemp: string): number {
    const minTempNum = Number(minTemp);
    if (isNaN(minTempNum) || isNaN(indoorTemp)) {
        console.error('Invalid temperature values:', { indoorTemp, minTemp });
        return 0;
    }
    return Number((indoorTemp - minTempNum).toFixed(1));
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
        const isServer = typeof window === 'undefined';
        if (isServer) {
            // Server/background: use direct EtaApi call (no relative URL issues)
            const result = await etaApi.setUserVar(id, scaledPosition, "0", "0");
            if (result.error || !result.result) {
                throw new Error(result.error || 'Empty response from ETA API');
            }
        } else {
            // Browser: call our Next.js API to avoid CORS against ETA device
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
            await response.json();
        }
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
