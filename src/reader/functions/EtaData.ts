import { DOMParser } from '@xmldom/xmldom';
import { EtaApi } from './EtaApi';
import { EtaConstants, Names2Id } from './types-constants/Names2IDconstants';
import { Config, ConfigKeys } from './types-constants/ConfigConstants';
import { EtaData, ParsedXmlData } from './types-constants/EtaConstants';

export const fetchEtaData = async (
    config: Config, 
    names2id: Names2Id
): Promise<EtaData> => {
    const etaApi = new EtaApi(config[ConfigKeys.S_ETA]);
    const shortkeys = Object.values(EtaConstants);
    const data: EtaData = {};
//    console.log("Fetching all ETA data", names2id);
    await Promise.all(shortkeys.map(shortkey => prepareAndFetchGetUserVar(shortkey, data, names2id, etaApi)));

    return data;
};

export const parseXML = (content: string, shortkey: string, names2id: Names2Id | null): ParsedXmlData => {
//    console.log(`Parsing XML for ${shortkey}:`, content);
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, 'text/xml');
    
    // Get the value element
    const valueElement = xmlDoc.getElementsByTagName('value')[0];
    
    let longName = ""; 
    if (names2id != null) {
        longName = names2id[shortkey]?.['name'] ?? 'N/A';
    }

    const textValue = valueElement?.textContent ?? 'N/A';
    const strValue = valueElement?.getAttribute('strValue') ?? 'N/A';
/*    
    console.log(`XML Parse Result for ${shortkey}:`, {
        textValue,
        strValue,
        uri: valueElement?.getAttribute('uri'),
    });
*/
    const result: ParsedXmlData = {
        id: valueElement?.getAttribute('uri') ?? '',
        parentId: null,
        value: textValue,
        long: longName,
        short: shortkey,
        strValue: strValue,
        unit: valueElement?.getAttribute('unit') ?? '',
        uri: valueElement?.getAttribute('uri') ?? '',
        scaleFactor: valueElement?.getAttribute('scaleFactor') ?? '1',
        decPlaces: valueElement?.getAttribute('decPlaces') ?? '0',
        advTextOffset: valueElement?.getAttribute('advTextOffset') ?? '0'
    };

    // Add root element attributes
    Array.from(xmlDoc.documentElement.attributes).forEach((attr: Attr) => {
        result[`eta_${attr.nodeName}`] = attr.nodeValue ?? 'N/A';
    });

    // Add value element attributes if not already added
    if (valueElement) {
        Array.from(valueElement.attributes).forEach((attr: Attr) => {
            if (!result[attr.nodeName]) {
                result[attr.nodeName] = attr.nodeValue ?? 'N/A';
            }
        });
    }

    // console.log(`Parsed ${shortkey} data:`, result);
    return result;
};

export const prepareAndFetchGetUserVar = async (shortkey: string, data: EtaData, names2id: Names2Id, etaApi: EtaApi): Promise<void> => {
    try {
//        console.log(`Fetching data for ${shortkey}`);
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
