import { DOMParser } from 'xmldom';
import  EtaApi  from './EtaApi';

export const ETA = 'ETA';

const etaApi = new EtaApi();

class FetchEta {
    
    private config: { [key: string]: any };
    private names2id: {[key: string]: {[key: string]: string }};
    constructor(config: { [key: string]: string }, names2id: {[key: string]: {[key: string]: string }}) {
        this.config = config;
        this.names2id = names2id;
    }
    public fetchEtaData(): { [key: string]: {[key: string]: string } } {
        const data: { [key: string]: {[key: string]: string } } = {};
        this.prepareAndFetchGetUserVar('HEIZKURVE', data);
        this.prepareAndFetchGetUserVar('SCHIEBERPOS', data);
        this.prepareAndFetchGetUserVar('AUSSENTEMP', data);
        this.prepareAndFetchGetUserVar('VORRAT', data);
        this.prepareAndFetchGetUserVar('INHALT_PELLETS_BEHALTER', data);
        this.prepareAndFetchGetUserVar('SCHALTZUSTAND', data);
        this.prepareAndFetchGetUserVar('EIN_AUS_TASTE', data);
        this.prepareAndFetchGetUserVar('HEIZENTASTE', data);
        this.prepareAndFetchGetUserVar('KOMMENTASTE', data);
        this.prepareAndFetchGetUserVar('KESSELTEMP', data);
        this.prepareAndFetchGetUserVar('VORLAUFTEMP', data);

        if (Object.keys(data['ETA']).length > 0) {
            const jeta = JSON.stringify(data['ETA']);
            this.writeData(this.config['F_ETA'], jeta);
            console.log(data['ETA']);
        }
        return data;
    }


    private parseXML(content: string, shortkey: string): { [key: string]: string } {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');
        const result: { [key: string]: string } = {};
        const attributes = xmlDoc.documentElement.attributes;
    
        for (let i = 0; i < attributes.length; i++) {
            const attribute = attributes[i];
            
            result[attribute.nodeName] = attribute.nodeValue ?? 'N/A';
        }
    
        result['value'] = xmlDoc.documentElement.textContent ?? 'N/A';
        result['long'] = this.names2id[shortkey]['name'];
        result['short'] = shortkey;
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
    private async prepareAndFetchGetUserVar(shortkey: string, data:  { [key: string]: {[key: string]: string } }): Promise<void> {
        const result = await etaApi.fGetUserVar(this.names2id[shortkey]['id']);

        if (result.error === false && typeof result.result === 'string') {
            data[this.names2id[shortkey]['id']] = this.parseXML(result.result, shortkey);
        } else {
            console.log(result.error);
        }
    }

    private writeData(file: string, data: string): void {
        const fs = require('fs');
        fs.writeFileSync(file, data);
    }
}
export default FetchEta;