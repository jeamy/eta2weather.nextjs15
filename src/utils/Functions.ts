import Diff from "@/reader/functions/Diff";
import { ConfigState } from "@/redux/configSlice";
import { WifiAF83State } from "@/redux/wifiAf83Slice";
import { EtaApi } from '@/reader/functions/EtaApi';
import { EtaConstants } from "@/reader/functions/types-constants/Names2IDconstants";

type EtaValues = {
    einaus: string;
    schaltzustand: string;
    kommenttaste: string;
    tes: number;
    tea: number;
};

type TempDiff = {
    diff: number | null;
    twa: number;
    twi: number;
};

export function calculateNewSliderPosition({ einaus, schaltzustand, kommenttaste }: EtaValues, diff: number): string {
    
//    console.log(`
//      Einaus: ${einaus}
//      Schaltzustand: ${schaltzustand}
//      Kommenttaste: ${kommenttaste}
//      Diff: ${diff}
//    `);
    return (einaus === "Aus" || (schaltzustand === "Aus" && kommenttaste === "Aus"))
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
    console.log(`Diff calculation: ${tSollNum} + ${tDeltaNum} - ${twi} = ${diff}`);
    return { diff: Number(diff.toFixed(1)), twa, twi };
}

export interface EtaApiInterface {
    setUserVar: (id: string, value: string, flags: string, index: string) => Promise<void>;
}

export async function updateSliderPosition(
    newPosition: string,
    currentPosition: number,
    names2id: Record<string, { id: string }>,
    etaApi: EtaApi
): Promise<{ success: boolean; position: number }> {
    if (Number(newPosition) === currentPosition) {
        return { success: true, position: currentPosition };
    }

    const id = names2id[EtaConstants.SCHIEBERPOS]?.['id'];
    if (!id) {
        throw new Error('Slider position ID not found');
    }

    const scaledPosition = String(Number(newPosition) * 10);
    console.log(`Setting slider position from ${currentPosition} to ${newPosition} (scaled: ${scaledPosition})`);
    
    // Set the new position
    await etaApi.setUserVar(id, scaledPosition, "0", "0");

    // Verify the position was set correctly
    const verifyResponse = await etaApi.getUserVar(id);
    if (!verifyResponse.result) {
        throw new Error('Failed to verify slider position update');
    }

    const updatedPosition = Number(verifyResponse.result) / 10;
    console.log(`Verified slider position: ${updatedPosition}`);

    const success = Math.abs(Number(newPosition) - updatedPosition) <= 0.1;
    if (!success) {
        console.warn(`Slider position verification failed. Expected: ${newPosition}, Got: ${updatedPosition}`);
    }

    return { success, position: updatedPosition };
}
