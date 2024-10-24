import { Config, ConfigKeys } from "./Config";
import * as fs from 'fs/promises';
import WifiAf83Api from './WifiAf83Api';
import { useDispatch } from "react-redux";
import { setIsLoading, storeData, storeError } from "@/redux/wifiAf83Slice";


export const WIFIAF83 = 'WIFIAF83';

export interface WifiAF83Data {
    time: number;
    datestring: string;
    [key: string]: any;
}

export class FetchWifiAf83 {
    private readonly config: Record<string, string>;
    private readonly wifiaf83Api: WifiAf83Api;

    constructor(config: Config) {
        this.config = config;
        this.wifiaf83Api = new WifiAf83Api(); 
    }

    public async fetchWifiAF83Data(): Promise<WifiAF83Data>  {
            const result = await this.wifiaf83Api.getRealtime();
            if (result.error) {
                throw new Error(result.error);
            }

            const data = { } as WifiAF83Data;
            data[WIFIAF83] = JSON.parse(result.result);
            this.formatDateTime(data);
            if(Object.keys(data[WIFIAF83]).length > 0) {
                await this.writeData(data);
                console.log(data[WIFIAF83]);
            }

            return data;
    }

    private formatDateTime(data: WifiAF83Data): void {
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
    }

    private async writeData(data: WifiAF83Data): Promise<void> {
        const filePath = this.config[ConfigKeys.F_WIFIAF83];
        const jsonData = JSON.stringify(data);
        await fs.writeFile(filePath, jsonData);
    }
}

export function useWifiReadAndStore(config: Config) {
    const dispatch = useDispatch();

    const loadAndStoreWifi = async () => {
        dispatch(setIsLoading(true));
        const loadWifiData = new FetchWifiAf83(config);
        Promise.all([loadWifiData.fetchWifiAF83Data()])
        .then((response) => {
            dispatch(storeData(response[0]));   
        })  
        .catch((error) => {
            dispatch(storeError(error.message));    
        })  
        .finally(() => dispatch(setIsLoading(false)));  
    };

    return loadAndStoreWifi;
}

