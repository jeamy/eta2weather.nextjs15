import { ConfigKeys } from "./Config";
import * as fs from 'fs/promises';
import WifiAf83Api from './WifiAf83Api'; 

export const WIFIAF83 = 'WIFIAF83';

export interface WifiAF83Data {
    time: number;
    datestring: string;
    [key: string]: any;
}

class FetchWifiAf83 {
    private readonly config: Record<string, string>;
    private data: WifiAF83Data = {} as WifiAF83Data;
    private wifiaf83: any; 

    constructor(config: Record<string, string>) {
        this.config = config;
        this.wifiaf83 = new WifiAf83Api(); // Initialisieren Sie wifiaf83 hier
    }

    public async fetchWifiAF83Data(): Promise<WifiAF83Data | { error: any }> {
        try {
            const data: WifiAF83Data = {
                [WIFIAF83]: {},
                time: Date.now(),
                datestring: ''
            };
            const result = await this.wifiaf83.getRealtime();
            if (result.error) {
                throw new Error(result.error);
            }

            data[WIFIAF83] = JSON.parse(result.result);
            this.formatDateTime();
            await this.writeData();

            return this.data;
        } catch (error) {
            console.error("Fehler beim Abrufen der WifiAF83-Daten:", error);
            return { error };
        }
    }

    private formatDateTime(): void {
        const date = new Date(this.data.time);
        this.data.datestring = date.toLocaleString('de-DE', {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    }

    private async writeData(): Promise<void> {
        const filePath = this.config[ConfigKeys.F_WIFIAF83];
        const jsonData = JSON.stringify(this.data);
        await fs.writeFile(filePath, jsonData);
    }
}

export default FetchWifiAf83;
