import { WifiData } from './WifiConstants';

export const WIFIAF83 = 'WIFIAF83';

export interface WifiAF83Data {
    time: number;
    datestring: string;
    temperature: number;
    indoorTemperature: number;
    allData: WifiData | null;
    stale?: boolean;
}
