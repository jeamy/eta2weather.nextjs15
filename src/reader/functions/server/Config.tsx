'use server';

import { promises as fs } from 'fs';
import { Config, defaultConfig } from '../types-constants/ConfigConstants';

export const readConfig = async (fconfig: string): Promise<Config> => {
    try {
        if (!await fs.readFile(fconfig)) {
            await fs.writeFile(fconfig, JSON.stringify(defaultConfig));
        }

        const configData = await fs.readFile(fconfig, 'utf8');
        const result = JSON.parse(configData);
        console.log('Konfiguration geladen');
        console.log(result);
        return result;
    } catch (error) {
        console.error('Fehler beim Lesen der Konfigurationsdatei:', error);
    }
    return defaultConfig;
};


