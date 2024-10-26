
'use server';

import { DOMParser } from 'xmldom';
import { EtaApi } from '../EtaApi';
import { promises as fs } from 'fs';

import { EtaConstants, Names2Id } from '../../Names2Id';
import { Config, ConfigKeys } from '../types-constants/ConfigConstants';
import { ETA, EtaData, ParsedXmlData } from '../types-constants/EtaConstants';


export const fetchEtaData = async (config: Config, names2id: Names2Id): Promise<EtaData> => {
    const etaApi = new EtaApi(config.S_ETA);
    const shortkeys = Object.values(EtaConstants);
    const data: EtaData = {} as EtaData;

    await Promise.all(shortkeys.map(shortkey => prepareAndFetchGetUserVar(shortkey, data, names2id, etaApi)));

    if (Object.keys(data[ETA]).length > 0) {
        await writeData(data, config);
        console.log(data[ETA]);
    }
    return data;
};

const parseXML = (content: string, shortkey: string, names2id: Names2Id): ParsedXmlData => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, 'text/xml');
    const result: ParsedXmlData = {
        value: xmlDoc.documentElement.textContent ?? 'N/A',
        long: names2id[shortkey]?.['name'] ?? 'N/A',
        short: shortkey
    };

    Array.from(xmlDoc.documentElement.attributes).forEach(attr => {
        result[attr.nodeName] = attr.nodeValue ?? 'N/A';
    });

    return result;
};

const prepareAndFetchGetUserVar = async (shortkey: string, data: EtaData, names2id: Names2Id, etaApi: EtaApi): Promise<void> => {
    try {
        const id = names2id[shortkey]?.['id'];
        if (!id) {
            throw new Error(`Keine ID gefunden für shortkey: ${shortkey}`);
        }

        const result = await etaApi.getUserVar(id);

        if (typeof result === 'string') {
            data[ETA][id] = parseXML(result, shortkey, names2id);
        } else {
            console.error(`Unerwartetes Ergebnis für ${shortkey}:`, result);
        }
    } catch (error) {
        console.error(`Fehler beim Abrufen der Daten für ${shortkey}:`, error);
    }
};

const writeData = async (data: EtaData, config: Config): Promise<void> => {
    const filePath = config[ConfigKeys.F_ETA];
    const jsonData = JSON.stringify(data);

    try {
        await fs.access(filePath);
    } catch (error) {
        await fs.writeFile(filePath, jsonData);
    }

};