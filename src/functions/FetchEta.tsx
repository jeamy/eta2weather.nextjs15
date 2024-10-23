import { DOMParser } from 'xmldom';
import { EtaApi } from './EtaApi';
import * as fs from 'fs/promises';

import { EtaConstants, Names2Id } from './Names2Id';
import { useDispatch } from 'react-redux';
import { setIsLoading, storeData, storeError } from '../redux/etaSlice';
import { Config, ConfigKeys } from './Config';

export const ETA = 'ETA';

// Neue Typdefinitionen
export type ParsedXmlData = Record<string, string>;
export type EtaData = Record<string, Record<string, ParsedXmlData>>;

export class FetchEta {

    private readonly etaApi: EtaApi;
    private readonly config: Config;
    private readonly names2id: Names2Id;

    constructor(config: Config, names2id: Names2Id) {
        this.config = config;
        this.names2id = names2id;
        this.etaApi = new EtaApi(config.S_ETA);
    }

    /**
     * Fetches the Eta data from the Eta server and writes it to the json file
     * specified in the config.
     * @returns { [key: string]: {[key: string]: string } } The Eta data with the
     * shortkey as the key and the data as the value.
     */
    public async fetchEtaData(): Promise<EtaData> {
        const shortkeys = Object.values(EtaConstants);
        const data: EtaData = { } as EtaData;

        await Promise.all(shortkeys.map(shortkey => this.prepareAndFetchGetUserVar(shortkey, data)));

        if (Object.keys(data[ETA]).length > 0) {
            await this.writeData(data);
            console.log(data[ETA]);
        }
        return data;
    }

    /**
     * Parse the given XML content and return the data as an object.
     * The object will contain the following properties:
     * - value: the text content of the XML element
     * - long: the long name of the element, based on the shortkey
     * - short: the shortkey of the element
     * - all other properties are the attributes of the XML element
     * @param content the XML content to parse
     * @param shortkey the shortkey of the element
     * @returns an object with the parsed data
     */
    private parseXML(content: string, shortkey: string): ParsedXmlData {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');
        const result: ParsedXmlData = {
            value: xmlDoc.documentElement.textContent ?? 'N/A',
            long: this.names2id[shortkey]?.['name'] ?? 'N/A',
            short: shortkey
        };

        Array.from(xmlDoc.documentElement.attributes).forEach(attr => {
            result[attr.nodeName] = attr.nodeValue ?? 'N/A';
        });

        return result;
    }

    /**
     * Prepare and fetch the Eta data for a given shortkey.
     * The data is fetched from the Eta server with the id associated with the shortkey.
     * If the fetch is successful, the data is parsed and stored in the data object.
     * If the fetch fails, an error is logged to the console.
     * @param shortkey the shortkey to fetch the data for
     * @param data the object to store the fetched data in
     */
    public async prepareAndFetchGetUserVar(shortkey: string, data: EtaData): Promise<void> {
        try {
            const id = this.names2id[shortkey]?.['id'];
            if (!id) {
                throw new Error(`Keine ID gefunden für shortkey: ${shortkey}`);
            }

            const result = await this.etaApi.getUserVar(id);

            if (typeof result === 'string') {
                data[ETA][id] = this.parseXML(result, shortkey);
            } else {
                console.error(`Unerwartetes Ergebnis für ${shortkey}:`, result);
            }
        } catch (error) {
            console.error(`Fehler beim Abrufen der Daten für ${shortkey}:`, error);
        }
    }

    private async writeData(data: EtaData): Promise<void> {
        const filePath = this.config[ConfigKeys.F_ETA];
        const jsonData = JSON.stringify(data);
        await fs.writeFile(filePath, jsonData);
    }
}

export function useEtaReadAndStore(config: Config, names2id: Names2Id) {
    const dispatch = useDispatch();

    const loadAndStoreEta = async () => {
        dispatch(setIsLoading(true));
        try {
            const loadEtaData = new FetchEta(config, names2id);
            const eta = await loadEtaData.fetchEtaData();
            dispatch(storeData(eta));
        } catch (error: Error | any) {
            dispatch(storeError(error.message));
        }
    };

    return loadAndStoreEta;
}

