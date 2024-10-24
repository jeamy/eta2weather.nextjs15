import * as fs from 'fs';
import { Config, ConfigKeys } from './Config';
import { useDispatch } from 'react-redux';
import { setIsLoading, storeData, storeError } from '../redux/names2IdSlice';

export enum EtaConstants {
  HEIZKURVE = 'HK',
  SCHIEBERPOS = 'SP',
  AUSSENTEMP = 'AT',
  VORRAT = 'VR',
  INHALT_PELLETS_BEHALTER = 'IP',
  SCHALTZUSTAND = 'SZ',
  EIN_AUS_TASTE = 'EAT',
  KESSELTEMP = 'KZ',
  HEIZENTASTE = 'HT',
  KOMMENTASTE = 'KT',
  VORLAUFTEMP = 'VT',
}

export type Names2Id = Record<string, { id: string; name: string }>;

// defaultNames2id 
const defaultNames2Id: Names2Id = {
  [EtaConstants.HEIZKURVE]: { id: "/120/10101/0/0/12111", name: "Heizkurve" },
  [EtaConstants.SCHIEBERPOS]: { id: "/120/10101/0/0/12240", name: "Schieber Position" },
  [EtaConstants.AUSSENTEMP]: { id: "/120/10101/0/0/12197", name: "Außentemperatur" },
  [EtaConstants.VORRAT]: { id: "/40/10201/0/0/12015", name: "Vorrat" },
  [EtaConstants.INHALT_PELLETS_BEHALTER]: { id: "/40/10021/0/0/12011", name: "Inhalt Pelletsbehälter" },
  [EtaConstants.SCHALTZUSTAND]: { id: "/120/10101/12113/0/1109", name: "Schaltzustand" },
  [EtaConstants.EIN_AUS_TASTE]: { id: "/120/10101/0/0/12080", name: "Ein/Aus Taste" },
  [EtaConstants.KESSELTEMP]: { id: "/40/10021/0/11109/0", name: "Kessel Temperatur" },
  [EtaConstants.HEIZENTASTE]: { id: "/120/10101/0/0/12125", name: "Heizen Taste" },
  [EtaConstants.KOMMENTASTE]: { id: "/120/10101/0/0/12218", name: "Kommen Taste" },
  [EtaConstants.VORLAUFTEMP]: { id: "/120/10101/0/0/12241", name: "Vorlauf Temperatur" },
};

export class Names2IdReader {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  public readNames2Id(): Names2Id {
    const filePath = this.config[ConfigKeys.F_NAMES2ID];
    
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultNames2Id));
    }
    
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
}

export const useLoadNames2Id = (config: Config) => {
  const dispatch = useDispatch();
  
  const loadAndStoreNames2Id = async () => {
    dispatch(setIsLoading(true));
    const reader = new Names2IdReader(config);
    Promise.all([reader.readNames2Id()])
      .then((response) => {
        dispatch(storeData(response[0]));
      })
      .catch((error) => {
        dispatch(storeError(error.message));
      })
      .finally(() => dispatch(setIsLoading(false)));
  };

  return loadAndStoreNames2Id;
};

