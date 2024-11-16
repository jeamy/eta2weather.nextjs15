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

export function calculateTemperatureDiff(config: ConfigState, wifiAf83Data: WifiAF83State): TempDiff {

    const { indoor, outdoor } = wifiAf83Data.data;
    const twi = indoor.temperature.value;
    const twa = outdoor.temperature.value;
    const { t_soll, t_delta } = config.data;

    console.log(`
      Außentemperatur ETA: ${twi}
      Außentemperatur: ${twa}
      Innentemperatur: ${twi}
      Solltemperatur: ${t_soll}
      Deltatemperatur: ${t_delta}
    `);

    const diff = Math.min(Number(t_soll) + Number(t_delta) - twi, 5.0);
    return { diff: Number(diff.toFixed(1)), twa, twi };
}
