import Diff from "@/reader/functions/Diff";
import { ConfigState } from "@/redux/configSlice";
import { WifiAF83State } from "@/redux/wifiAf83Slice";

type EtaValues = {
    einaus: string;
    schalt: string;
    kommenttaste: string;
    tes: number;
    tea: number;
};

type TempDiff = {
    diff: number | null;
    twa: number;
    twi: number;
};

export function calculateNewSliderPosition({ einaus, schalt, kommenttaste }: EtaValues, diff: number): string {
    return (einaus === "Aus" || (schalt === "Aus" && kommenttaste === "Aus"))
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
