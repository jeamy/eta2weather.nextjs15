import Diff from "@/reader/functions/Diff";
import { ConfigState } from "@/redux/configSlice";
import { WifiAF83State } from "@/redux/wifiAf83Slice";
import { EtaApi } from '@/reader/functions/EtaApi';
import { EtaConstants, Names2Id } from "@/reader/functions/types-constants/Names2IDconstants";
import { TEMP_CALC_CONSTANTS } from '@/reader/functions/types-constants/ConfigConstants';
import { calculateLiveTemperatureDiff } from './temperatureCalculations';

type EtaValues = {
    einaus: string;
    schaltzustand: string;
    heizentaste: string;
    kommentaste: string;
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

    const diff = calculateLiveTemperatureDiff(tSollNum, tDeltaNum, twi);
    if (diff === null) {
        console.error('Invalid temperature values:', { t_soll, t_delta, twi });
        return { diff: null, twa, twi };
    }

    return { diff: Math.min(diff, 5.0), twa, twi };
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
        const result = await etaApi.setUserVar(id, scaledPosition, "0", "0");
        if (result.error || !result.result) {
            throw new Error(result.error || 'Empty response from ETA API');
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
