import { DOMParser } from '@xmldom/xmldom';
import { EtaApi } from './EtaApi';
import { EtaConstants, Names2Id } from './types-constants/Names2IDconstants';
import { Config, ConfigKeys } from './types-constants/ConfigConstants';
import { EtaData, ParsedXmlData } from './types-constants/EtaConstants';

const DEBUG = process.env.NODE_ENV === 'development';

/**
 * Parse XML response from ETA API
 */
export const parseXML = (content: string, shortkey: string, names2id: Names2Id | null): ParsedXmlData => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, 'text/xml');

    // Get the value element
    const valueElement = xmlDoc.getElementsByTagName('value')[0];

    if (!valueElement) {
        throw new Error(`No value element found in XML for ${shortkey}`);
    }

    // Get long name from names2id mapping
    const longName = names2id?.[shortkey]?.['name'] ?? 'N/A';

    // Extract attributes with defaults
    const getAttribute = (name: string, defaultValue: string = ''): string => {
        return valueElement.getAttribute(name) ?? defaultValue;
    };

    const result: ParsedXmlData = {
        id: getAttribute('uri'),
        parentId: null,
        value: valueElement.textContent ?? 'N/A',
        long: longName,
        short: shortkey,
        strValue: getAttribute('strValue', 'N/A'),
        unit: getAttribute('unit'),
        uri: getAttribute('uri'),
        scaleFactor: getAttribute('scaleFactor', '1'),
        decPlaces: getAttribute('decPlaces', '0'),
        advTextOffset: getAttribute('advTextOffset', '0')
    };

    // Add root element attributes with 'eta_' prefix
    Array.from(xmlDoc.documentElement.attributes).forEach((attr: Attr) => {
        result[`eta_${attr.nodeName}`] = attr.nodeValue ?? 'N/A';
    });

    // Add value element attributes (skip duplicates)
    Array.from(valueElement.attributes).forEach((attr: Attr) => {
        if (!(attr.nodeName in result)) {
            result[attr.nodeName] = attr.nodeValue ?? 'N/A';
        }
    });

    return result;
};

/**
 * Fetch single user variable from ETA API
 */
const fetchUserVar = async (
    shortkey: string,
    names2id: Names2Id,
    etaApi: EtaApi
): Promise<ParsedXmlData | null> => {
    const id = names2id[shortkey]?.['id'];

    if (!id) {
        if (DEBUG) {
            console.warn(`[EtaData] No ID found for shortkey: ${shortkey}`);
        }
        return null;
    }

    try {
        const response = await etaApi.getUserVar(id);

        if (response.error) {
            if (DEBUG) {
                console.error(`[EtaData] Error fetching ${shortkey}:`, response.error);
            }
            return null;
        }

        if (!response.result) {
            if (DEBUG) {
                console.warn(`[EtaData] Empty result for ${shortkey}`);
            }
            return null;
        }

        return parseXML(response.result, shortkey, names2id);

    } catch (error) {
        if (DEBUG) {
            console.error(`[EtaData] Exception fetching ${shortkey}:`, error);
        }
        return null;
    }
};

/**
 * Fetch all ETA data in parallel
 */
export const fetchEtaData = async (
    config: Config,
    names2id: Names2Id
): Promise<EtaData> => {
    const etaApi = new EtaApi(config[ConfigKeys.S_ETA]);
    const shortkeys = Object.values(EtaConstants);

    try {
        // Fetch all data in parallel
        const results = await Promise.allSettled(
            shortkeys.map(shortkey => fetchUserVar(shortkey, names2id, etaApi))
        );

        // Build data object from successful results
        const data: EtaData = {};

        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                const parsedData = result.value;
                // Use URI as key, fallback to ID if URI is empty
                const key = parsedData.uri || parsedData.id;
                if (key) {
                    data[key] = parsedData;
                } else if (DEBUG) {
                    console.warn(`[EtaData] No URI or ID for ${shortkeys[index]}, skipping`);
                }
            } else if (result.status === 'rejected' && DEBUG) {
                console.error(`[EtaData] Failed to fetch ${shortkeys[index]}:`, result.reason);
            }
        });

        if (DEBUG) {
            const successCount = Object.keys(data).length;
            const totalCount = shortkeys.length;
            console.log(`[EtaData] Fetched ${successCount}/${totalCount} variables`);
        }

        return data;

    } finally {
        // Always dispose the API instance
        etaApi.dispose();
    }
};

/**
 * Legacy function for backward compatibility
 * @deprecated Use fetchUserVar directly instead
 */
export const prepareAndFetchGetUserVar = async (
    shortkey: string,
    data: EtaData,
    names2id: Names2Id,
    etaApi: EtaApi
): Promise<void> => {
    const result = await fetchUserVar(shortkey, names2id, etaApi);

    if (result) {
        // Use URI as key, fallback to ID if URI is empty
        const key = result.uri || result.id;
        if (key) {
            data[key] = result;
        } else if (DEBUG) {
            console.warn(`[EtaData] No URI or ID for ${shortkey}, skipping`);
        }
    }
};
