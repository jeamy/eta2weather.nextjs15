
import { promises as fs } from 'fs';

// Konstanten als Enum definieren
export enum ConfigKeys {
    T_SOLL = 'T_SOLL',
    T_DELTA = 'T_DELTA',
    F_ETA = 'F_ETA',
    S_ETA = 'S_ETA',
    F_WIFIAF83 = 'F_WIFIAF83',
    F_NAMES2ID = 'F_NAMES2ID',
    T_UPDATE_TIMER = 'T_UPDATE_TIMER'
}

// Typdefinition für die Konfiguration
export type Config = Record<ConfigKeys, string>;

export const defaultConfig: Config = {
    [ConfigKeys.T_SOLL]: '22',
    [ConfigKeys.T_DELTA]: '0',
    [ConfigKeys.F_ETA]: 'f_eta.json',
    [ConfigKeys.S_ETA]: '192.168.8.100:8080',
    [ConfigKeys.F_WIFIAF83]: 'f_wifiaf89.json',
    [ConfigKeys.F_NAMES2ID]: 'f_names2id.json',
    [ConfigKeys.T_UPDATE_TIMER]: '30'
};

export class ConfigReader {
    private readonly fconfig: string;
    private config: Config = defaultConfig;
    private lastModified: number = 0;
    private checkInterval: NodeJS.Timeout;
    private updateInterval: number = Number(defaultConfig[ConfigKeys.T_UPDATE_TIMER]) * 60 * 1000;

    constructor(fconfig: string) {
        this.fconfig = fconfig;
        this.checkInterval = setInterval(() => this.checkAndUpdateConfig(), this.updateInterval); // Alle n Minuten
        this.checkAndUpdateConfig(); // Initial einlesen
    }

    private async checkAndUpdateConfig(): Promise<void> {
        try {
            const stats = await fs.stat(this.fconfig);
            if (stats.mtimeMs > this.lastModified) {
                await this.readConfig();
                this.lastModified = stats.mtimeMs;
                console.log('Konfiguration aktualisiert');
            }
        } catch (error) {
            console.error('Fehler beim Überprüfen der Konfigurationsdatei:', error);
        }
    }
    public async readConfig(): Promise<Config> {
        try {
            if (!fs.readFile(this.fconfig)) {
                fs.writeFile(this.fconfig, JSON.stringify(defaultConfig));
            }
    
            const configData = await fs.readFile(this.fconfig, 'utf8');
            const result = JSON.parse(configData) 
            this.updateInterval = Number(result[ConfigKeys.T_UPDATE_TIMER]) * 60 * 1000;
            return result;
        } catch (error) {
            console.error('Fehler beim Lesen der Konfigurationsdatei:', error);
        }
        return defaultConfig;
    }

    public getConfig(): Config {
        return this.config;
    }

    public stopChecking(): void {
        clearInterval(this.checkInterval);
    }
}
