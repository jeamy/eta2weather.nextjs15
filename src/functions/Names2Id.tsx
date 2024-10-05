import * as fs from 'fs';

const F_NAMES2ID = 'F_NAMES2ID';

export const HEIZKURVE: string = 'HK';
export const SCHIEBERPOS: string = 'SP';
export const AUSSENTEMP: string = 'AT';
export const VORRAT: string = 'VR';
export const INHALT_PELLETS_BEHALTER: string = 'IP';
export const SCHALTZUSTAND: string = 'SZ';
export const EIN_AUS_TASTE: string = 'EAT';
export const KESSELTEMP: string = 'KZ';
export const HEIZENTASTE: string = 'HT';
export const KOMMENTASTE: string = 'KT';
export const VORLAUFTEMP: string = 'VT';

const defaultNames2id: {[key: string]: {[key: string]: string }} = {
    [HEIZKURVE]: { 
        id: "/120/10101/0/0/12111", 
        name: "Heizkurve" 
    },
    [SCHIEBERPOS]: { 
        id: "/120/10101/0/0/12240", 
        name: "Schieber Position" 
    },
    [AUSSENTEMP]: { 
        id: "/120/10101/0/0/12197", 
        name: "Außentemperatur" 
    },
    [VORRAT]: { 
        id: "/40/10201/0/0/12015", 
        name: "Vorrat" 
    },
    [INHALT_PELLETS_BEHALTER]: { 
        id: "/40/10021/0/0/12011", 
        name: "Inhalt Pelletsbehälter" 
    },
    [SCHALTZUSTAND]: { 
        id: "/120/10101/12113/0/1109",
         name: "Schaltzustand" 
        },
    [EIN_AUS_TASTE]: { 
        id: "/120/10101/0/0/12080", 
        name: "Ein/Aus Taste" 
    },
    [KESSELTEMP]: { 
        id: "/40/10021/0/11109/0", 
        name: "Kessel Temperatur" 
    },
    [HEIZENTASTE]: { 
        id: "/120/10101/0/0/12125", 
        name: "Heizen Taste" 
    },
    [KOMMENTASTE]: { 
        id: "/120/10101/0/0/12218", 
        name: "Kommen Taste" 
    },
    [VORLAUFTEMP]: { 
        id: "/120/10101/0/0/12241", 
        name: "Vorlauf Temperatur" 
    },
};

class Names2IdReader {
    private config: { [key: string]: string };

    constructor(config: { [key: string]: string }) {
        this.config = config;
    }
    public readNames2Id(): {[key: string]: {[key: string]: string }} {
    /**
     * Reads the names2id configuration file and returns the configuration as an object.
     * If the file does not exist, it is created with the default configuration.
     * @returns The configuration as an object.
     */
        const filePath = this.config[F_NAMES2ID];
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultNames2id));
        }
        const names2id: {[key: string]: {[key: string]: string }} = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return names2id;
    }
}
export default Names2IdReader;