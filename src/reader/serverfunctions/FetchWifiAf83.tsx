'use server';

import { Config } from "../Config";
import { FetchWifiAf83, WifiAF83Data } from "../WifiAf83";

export async function fetchWifiAF83Data(config: Config): Promise<WifiAF83Data> {
    const wifiaf83 = new FetchWifiAf83(config);
    const data = await wifiaf83.fetchWifiAF83Data();
    return data;
}