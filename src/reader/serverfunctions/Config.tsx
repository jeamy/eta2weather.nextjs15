
import { promises as fs } from 'fs';
import { Config, defaultConfig } from '../Config';

export async function readConfig(filePath: string): Promise<Config> {
    try {
        const configData = await fs.readFile(filePath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.error('Fehler beim Lesen der Konfigurationsdatei:', error);
        return defaultConfig;
    }
}