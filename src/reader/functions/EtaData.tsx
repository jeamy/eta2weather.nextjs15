'use server';

import { DOMParser } from 'xmldom';
import { EtaApi } from './EtaApi';
import { promises as fs } from 'fs';
import { EtaConstants, Names2Id } from './types-constants/Names2IDconstants';
import { Config, ConfigKeys } from './types-constants/ConfigConstants';
import { ETA, EtaData, ParsedXmlData } from './types-constants/EtaConstants';
import { storeData } from '../../redux/etaSlice';
import { AppDispatch } from '../../redux/index';

export const fetchEtaData = async (
    config: Config, 
    names2id: Names2Id, 
    dispatch?: AppDispatch
): Promise<EtaData> => {
    const etaApi = new EtaApi(config[ConfigKeys.S_ETA]);
    const shortkeys = Object.values(EtaConstants);
    const data: EtaData = {};

    await Promise.all(shortkeys.map(shortkey => prepareAndFetchGetUserVar(shortkey, data, names2id, etaApi)));

    if (Object.keys(data).length > 0) {
        await writeData(data, config);
        if (dispatch) {
            dispatch(storeData(data));
        }
    }
    return data;
};

const parseXML = (content: string, shortkey: string, names2id: Names2Id): ParsedXmlData => {
    console.log(`Parsing ${shortkey} Content:`, content);
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, 'text/xml');
    
    // Get the value element
    const valueElement = xmlDoc.getElementsByTagName('value')[0];
    
    const result: ParsedXmlData = {
        value: valueElement?.textContent ?? 'N/A',
        long: names2id[shortkey]?.['name'] ?? 'N/A',
        short: shortkey,
        strValue: valueElement?.getAttribute('strValue') ?? 'N/A',
        unit: valueElement?.getAttribute('unit') ?? '',
        uri: valueElement?.getAttribute('uri') ?? '',
        scaleFactor: valueElement?.getAttribute('scaleFactor') ?? '1',
        decPlaces: valueElement?.getAttribute('decPlaces') ?? '0',
        advTextOffset: valueElement?.getAttribute('advTextOffset') ?? '0'
    };

    // Add root element attributes
    Array.from(xmlDoc.documentElement.attributes).forEach(attr => {
        result[`eta_${attr.nodeName}`] = attr.nodeValue ?? 'N/A';
    });

    // Add value element attributes if not already added
    if (valueElement) {
        Array.from(valueElement.attributes).forEach(attr => {
            if (!result[attr.nodeName]) {
                result[attr.nodeName] = attr.nodeValue ?? 'N/A';
            }
        });
    }

    console.log(`Parsed ${shortkey} data:`, result);
    return result;
};

export const prepareAndFetchGetUserVar = async (shortkey: string, data: EtaData, names2id: Names2Id, etaApi: EtaApi): Promise<void> => {
    try {
        const id = names2id[shortkey]?.['id'];
        if (!id) {
            throw new Error(`Keine ID gefunden für shortkey: ${shortkey}`);
        }

        await etaApi.getUserVar(id)
            .then(res => {
                if (res.result) {
                    data[id] = parseXML(res.result, shortkey, names2id);
                }
            })
            .catch(error => {
                console.error(`Fehler beim Abrufen der Daten für ${shortkey}:`, error);
            })
            .finally(() => {
                // console.log(`Fetched data for ${shortkey}`);
            });
    } catch (error) {
        console.error(`Fehler beim Abrufen der Daten für ${shortkey}:`, error);
    }
};

const writeData = async (data: EtaData, config: Config): Promise<void> => {
    const filePath = config[ConfigKeys.F_ETA];
    const jsonData = JSON.stringify(data);

    try {
        await fs.writeFile(filePath, jsonData);
    } catch (error) {
        console.error('Error writing data to file:', error);
    }
};