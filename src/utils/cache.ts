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
import { Config, ConfigKeys, defaultConfig } from '@/reader/functions/types-constants/ConfigConstants';

export const CONFIG_CACHE_KEY = 'eta_config';
export const WIFIAF83_CACHE_KEY = 'wifiaf83_data';
export const NAMES2ID_CACHE_KEY = 'names2id_config';

const CONFIG_PATH = path.resolve(process.cwd(), process.env.CONFIG_PATH || 'src/config/f_etacfg.json');
const shared = globalThis as typeof globalThis & {
    __ETA2WEATHER_CONFIG_WRITE_CHAIN__?: Promise<void>;
    __ETA2WEATHER_WIFI_REFRESH__?: Promise<any> | null;
    __ETA2WEATHER_WIFI_FALLBACK__?: boolean;
    __ETA2WEATHER_CONFIG_CACHE__?: Cache<any>;
    __ETA2WEATHER_WIFI_CACHE__?: Cache<any>;
    __ETA2WEATHER_NAMES_CACHE__?: Cache<Names2Id>;
};

// Create singleton cache instances with 3 seconds TTL
export const configCache = shared.__ETA2WEATHER_CONFIG_CACHE__ ??= new Cache<any>(1000*60);
export const wifiaf83Cache = shared.__ETA2WEATHER_WIFI_CACHE__ ??= new Cache<any>(1000*60*5);
export const names2idCache = shared.__ETA2WEATHER_NAMES_CACHE__ ??= new Cache<Names2Id>(1000*60*60);

export function normalizeNames2Id(value: unknown): Names2Id {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('names2id must be an object');
    }
    const normalized: Names2Id = {};
    for (const [short, rawEntry] of Object.entries(value)) {
        if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
            throw new Error(`Invalid names2id entry: ${short}`);
        }
        const entry = rawEntry as Record<string, unknown>;
        const rawId = typeof entry.id === 'string' ? entry.id.trim() : '';
        const name = typeof entry.name === 'string' ? entry.name : short;
        if (!rawId) throw new Error(`Missing names2id id: ${short}`);
        const withoutPrefix = rawId.replace(/^\/?user\/var\/+/, '').replace(/^\/+/, '');
        normalized[short] = { id: `/${withoutPrefix}`, name };
    }
    return normalized;
}

async function getConfiguredDataPath(
    key: ConfigKeys.F_NAMES2ID | ConfigKeys.F_WIFIAF83,
    fallback: string,
): Promise<string> {
    const config = await getConfig();
    const fileName = config[key] || fallback;
    const configDir = path.resolve(process.cwd(), 'src', 'config');
    const resolvedPath = path.resolve(configDir, fileName);
    if (resolvedPath !== configDir && !resolvedPath.startsWith(`${configDir}${path.sep}`)) {
        throw new Error(`Configured ${key} path escapes src/config`);
    }
    return resolvedPath;
}

export async function getConfig(forceRefresh = false): Promise<Config> {
    if (!forceRefresh) {
        // Try to get config from cache first
        const cachedConfig = configCache.get(CONFIG_CACHE_KEY);
        if (cachedConfig) {
            return cachedConfig;
        }
    }

    // If not in cache, read from file
    let config: Config;
    try {
        const configData = await fs.readFile(CONFIG_PATH, 'utf8');
        config = JSON.parse(configData);
    } catch (error: any) {
        if (error?.code !== 'ENOENT') {
            throw error;
        }
        config = defaultConfig;
        await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
        await fs.writeFile(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), 'utf8');
    }
    
    // Store in cache
    configCache.set(CONFIG_CACHE_KEY, config);
    return config;
}

export async function updateConfig(
    newConfig: Record<string, unknown> | ((current: Config) => Partial<Config> | null)
): Promise<Config | null> {
    const writeTask = async () => {
        // Get existing config
        let existingConfig: Config;
        try {
            const configData = await fs.readFile(CONFIG_PATH, { encoding: 'utf8', flag: 'r' });
            existingConfig = JSON.parse(configData);
        } catch (error: any) {
            if (error?.code !== 'ENOENT') {
                console.error('Error reading existing config:', error);
                throw error;
            }
            existingConfig = defaultConfig;
        }

        const patch = typeof newConfig === 'function' ? newConfig(existingConfig) : newConfig;
        if (patch === null) return null;

        // Merge existing config with new config
        const mergedConfig = { ...existingConfig, ...patch };

        // Write atomically so concurrent readers never observe a partially written JSON file.
        const configStr = JSON.stringify(mergedConfig, null, 2);
        const tmpPath = `${CONFIG_PATH}.${process.pid}.${Date.now()}.tmp`;
        await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
        await fs.writeFile(tmpPath, configStr, { encoding: 'utf8', flag: 'w' });
        await fs.rename(tmpPath, CONFIG_PATH);

        // Update cache with merged config
        configCache.set(CONFIG_CACHE_KEY, mergedConfig);
        return mergedConfig;
    };

    const nextWrite = (shared.__ETA2WEATHER_CONFIG_WRITE_CHAIN__ ?? Promise.resolve()).then(writeTask, writeTask);
    shared.__ETA2WEATHER_CONFIG_WRITE_CHAIN__ = nextWrite.then(() => undefined, () => undefined);
    return nextWrite;
}

async function updateWifiAf83File(data: any) {
    try {
        const wifiPath = await getConfiguredDataPath(ConfigKeys.F_WIFIAF83, 'f_wifiaf89.json');
        const fileData = {
            code: 0,
            msg: "success",
            time: Math.floor(Date.now() / 1000).toString(),
            data: data,
            datestring: new Date().toLocaleString('de-DE', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric'
            }),
            diff: "0"
        };
        await fs.writeFile(wifiPath, JSON.stringify(fileData, null, 2));
    } catch (error) {
        console.error('Error writing to wifiaf83 file:', error);
    }
}

async function readWifiAf83File(): Promise<any> {
    try {
        const wifiPath = await getConfiguredDataPath(ConfigKeys.F_WIFIAF83, 'f_wifiaf89.json');
        // Check if file exists
        try {
            await fs.access(wifiPath);
        } catch {
            // File doesn't exist, create it with initial structure
            const initialData = {
                code: 0,
                msg: "success",
                time: Math.floor(Date.now() / 1000).toString(),
                data: {},
                datestring: new Date().toLocaleString('de-DE', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric'
                }),
                diff: "0"
            };
            await fs.writeFile(wifiPath, JSON.stringify(initialData, null, 2));
            return initialData.data;
        }

        // Read and parse file
        const data = await fs.readFile(wifiPath, 'utf8');
        if (!data.trim()) {
            throw new Error('File is empty');
        }

        try {
            const jsonData = JSON.parse(data);
            if (!jsonData || typeof jsonData !== 'object') {
                throw new Error('Invalid JSON structure');
            }
            return jsonData.data || {};
        } catch (parseError) {
            console.error('Error parsing wifiaf83 file:', parseError);
            // If JSON is invalid, reinitialize the file
            const initialData = {
                code: 0,
                msg: "success",
                time: Math.floor(Date.now() / 1000).toString(),
                data: {},
                datestring: new Date().toLocaleString('de-DE', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric'
                }),
                diff: "0"
            };
            await fs.writeFile(wifiPath, JSON.stringify(initialData, null, 2));
            return initialData.data;
        }
    } catch (error) {
        console.error('Error reading wifiaf83 file:', error);
        return {};
    }
}

export async function getWifiAf83Data(
    fetchFn: (signal?: AbortSignal) => Promise<any>,
    signal?: AbortSignal,
    options: { forceRefresh?: boolean; onFallback?: () => void } = {},
) {
    // Try to get data from cache first
    const cachedData = wifiaf83Cache.get(WIFIAF83_CACHE_KEY);

    if (cachedData && !options.forceRefresh) {
        if (shared.__ETA2WEATHER_WIFI_FALLBACK__) options.onFallback?.();
        return cachedData;
    }

    try {
        if (!shared.__ETA2WEATHER_WIFI_REFRESH__) {
            shared.__ETA2WEATHER_WIFI_REFRESH__ = (async () => {
                const response = await fetchFn(signal);
                if (!response || response.code !== 0) {
                    throw new Error(`Failed to fetch WifiAf83 data: ${response?.msg || 'Unknown error'}`);
                }
                wifiaf83Cache.set(WIFIAF83_CACHE_KEY, response.data);
                shared.__ETA2WEATHER_WIFI_FALLBACK__ = false;
                await updateWifiAf83File(response.data);
                return response.data;
            })().finally(() => {
                shared.__ETA2WEATHER_WIFI_REFRESH__ = null;
            });
        }
        return await shared.__ETA2WEATHER_WIFI_REFRESH__;
    } catch (error) {
        if (cachedData) {
            console.log('Using cached data after WiFi refresh failure');
            shared.__ETA2WEATHER_WIFI_FALLBACK__ = true;
            options.onFallback?.();
            return cachedData;
        }

        // If no cache and error is not rate limit, try file as last resort
        const fileData = await readWifiAf83File();
        if (fileData && Object.keys(fileData).length > 0) {
            console.log('Using file data as fallback');
            options.onFallback?.();
            shared.__ETA2WEATHER_WIFI_FALLBACK__ = true;
            wifiaf83Cache.set(WIFIAF83_CACHE_KEY, fileData);
            return fileData;
        }

        throw error;
    }
}

export async function getNames2Id(forceRefresh = false): Promise<Names2Id> {
    const config = await getConfig(forceRefresh);
    const fileName = config[ConfigKeys.F_NAMES2ID] || 'f_names2id.json';
    const names2idPath = await getConfiguredDataPath(ConfigKeys.F_NAMES2ID, 'f_names2id.json');
    const cacheKey = `${NAMES2ID_CACHE_KEY}:${fileName}`;

    // Try to get from cache first
    const cachedData = forceRefresh ? null : names2idCache.get(cacheKey);
    if (cachedData) {
        return cachedData;
    }

    // If not in cache, read from file
    const names2idData = await fs.readFile(names2idPath, 'utf8');
    const names2id = normalizeNames2Id(JSON.parse(names2idData));

    // Store in cache
    names2idCache.set(cacheKey, names2id);

    return names2id;
}
