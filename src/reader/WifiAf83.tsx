import * as fs from 'fs';
import { Config, ConfigKeys } from "./functions/server/Config";
import WifiAf83Api from './functions/WifiAf83Api';

export const WIFIAF83 = 'WIFIAF83';

export interface WifiAF83Data {
    time: number;
    datestring: string;
    [key: string]: any;
}

export const fetchWifiAF83Data = async (config: Config): Promise<WifiAF83Data> => {
    const wifiaf83Api = new WifiAf83Api();
    const result = await wifiaf83Api.getRealtime();
    if (result.error) {
        throw new Error(result.error);
    }

    const data = {} as WifiAF83Data;
    data[WIFIAF83] = JSON.parse(result.result);
    formatDateTime(data);
    if (Object.keys(data[WIFIAF83]).length > 0) {
        await writeData(data, config);
        console.log(data[WIFIAF83]);
    }

    return data;
};

const formatDateTime = (data: WifiAF83Data): void => {
    const date = new Date(data.time);
    data.datestring = date.toLocaleString('de-DE', {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
};

const writeData = async (data: WifiAF83Data, config: Config): Promise<void> => {
    const filePath = config[ConfigKeys.F_WIFIAF83];
    const jsonData = JSON.stringify(data);
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, jsonData);
    }
};
