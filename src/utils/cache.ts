interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

class Cache<T> {
    private data: Map<string, CacheEntry<T>> = new Map();
    private ttl: number;

    constructor(ttlMilliseconds: number) {
        this.ttl = ttlMilliseconds;
    }

    set(key: string, value: T): void {
        this.data.set(key, {
            data: value,
            timestamp: Date.now()
        });
    }

    get(key: string): T | null {
        const entry = this.data.get(key);
        if (!entry) return null;

        const isExpired = Date.now() - entry.timestamp > this.ttl;
        if (isExpired) {
            console.log(`Cache entry expired for key: ${key}`);
            this.data.delete(key);
            return null;
        }

        return entry.data;
    }

    clear(): void {
        this.data.clear();
    }
}

import { promises as fs } from 'fs';
import path from 'path';
import { Names2Id } from '@/reader/functions/types-constants/Names2IDconstants';

export const CONFIG_CACHE_KEY = 'eta_config';
export const WIFIAF83_CACHE_KEY = 'wifiaf83_data';
export const NAMES2ID_CACHE_KEY = 'names2id_config';

const CONFIG_PATH = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');
const NAMES2ID_PATH = path.join(process.cwd(), 'src', 'config', 'f_names2id.json');

// Create singleton cache instances with 3 seconds TTL
export const configCache = new Cache<any>(3000);
export const wifiaf83Cache = new Cache<any>(3000);
export const names2idCache = new Cache<Names2Id>(3000);

export async function getConfig() {
    // Try to get config from cache first
    const cachedConfig = configCache.get(CONFIG_CACHE_KEY);
    if (cachedConfig) {
        return cachedConfig;
    }

    // If not in cache, read from file
    const configData = await fs.readFile(CONFIG_PATH, 'utf8');
    const config = JSON.parse(configData);
    
    // Store in cache
    configCache.set(CONFIG_CACHE_KEY, config);
    return config;
}

export async function updateConfig(newConfig: any) {
    // Write the new config to file
    await fs.writeFile(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
    
    // Update cache with new config
    configCache.set(CONFIG_CACHE_KEY, newConfig);
}

export async function getWifiAf83Data(fetchFn: () => Promise<any>) {
    // Try to get data from cache first
    const cachedData = wifiaf83Cache.get(WIFIAF83_CACHE_KEY);
    if (cachedData) {
        return cachedData;
    }

    // If not in cache, fetch new data
    const response = await fetchFn();

    // Check if the response has the expected structure
    if (!response || response.code !== 0) {
        throw new Error(`Failed to fetch WifiAf83 data: ${response?.msg || 'Unknown error'}`);
    }

    // Store in cache
    wifiaf83Cache.set(WIFIAF83_CACHE_KEY, response.data);

    return response.data;
}

export async function getNames2Id(): Promise<Names2Id> {
    // Try to get from cache first
    const cachedData = names2idCache.get(NAMES2ID_CACHE_KEY);
    if (cachedData) {
        return cachedData;
    }

    // If not in cache, read from file
    const names2idData = await fs.readFile(NAMES2ID_PATH, 'utf8');
    const names2id: Names2Id = JSON.parse(names2idData);

    // Store in cache
    names2idCache.set(NAMES2ID_CACHE_KEY, names2id);

    return names2id;
}
