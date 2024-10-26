import { promises as fs } from 'fs';
import { readConfig } from "./functions/server/Config";
import { ConfigKeys, defaultConfig } from './functions/types-constants/ConfigConstants';

let lastModified: number = 0;
let checkInterval: NodeJS.Timeout;
let updateInterval: number = Number(defaultConfig[ConfigKeys.T_UPDATE_TIMER]) * 60 * 1000;

const initConfigReader = (fconfig: string): void => {
    checkInterval = setInterval(() => checkAndUpdateConfig(fconfig), updateInterval);
    checkAndUpdateConfig(fconfig); // Initial einlesen
};

const checkAndUpdateConfig = async (fconfig: string): Promise<void> => {
    try {
        const stats = await fs.stat(fconfig);
        if (stats.mtimeMs > lastModified) {
            const result = await readConfig(fconfig);
            updateInterval = Number(result[ConfigKeys.T_UPDATE_TIMER]) * 60 * 1000;
            lastModified = stats.mtimeMs;
            console.log('Konfiguration aktualisiert');
        }
    } catch (error) {
        console.error('Fehler beim Überprüfen der Konfigurationsdatei:', error);
    }
};

const stopChecking = (): void => {
    clearInterval(checkInterval);
};