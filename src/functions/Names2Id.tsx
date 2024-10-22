import * as fs from 'fs';
import { ConfigKeys } from './Config';
import { useDispatch } from 'react-redux';
import { setNames2IdData } from '../redux/names2IdSlice';

export enum Constants {
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

export type Names2IdType = Record<string, { id: string; name: string }>;

// defaultNames2id als separate Funktion
const getDefaultNames2Id = (): Names2IdType => ({
  [Constants.HEIZKURVE]: { id: "/120/10101/0/0/12111", name: "Heizkurve" },
  [Constants.SCHIEBERPOS]: { id: "/120/10101/0/0/12240", name: "Schieber Position" },
  [Constants.AUSSENTEMP]: { id: "/120/10101/0/0/12197", name: "Außentemperatur" },
  [Constants.VORRAT]: { id: "/40/10201/0/0/12015", name: "Vorrat" },
  [Constants.INHALT_PELLETS_BEHALTER]: { id: "/40/10021/0/0/12011", name: "Inhalt Pelletsbehälter" },
  [Constants.SCHALTZUSTAND]: { id: "/120/10101/12113/0/1109", name: "Schaltzustand" },
  [Constants.EIN_AUS_TASTE]: { id: "/120/10101/0/0/12080", name: "Ein/Aus Taste" },
  [Constants.KESSELTEMP]: { id: "/40/10021/0/11109/0", name: "Kessel Temperatur" },
  [Constants.HEIZENTASTE]: { id: "/120/10101/0/0/12125", name: "Heizen Taste" },
  [Constants.KOMMENTASTE]: { id: "/120/10101/0/0/12218", name: "Kommen Taste" },
  [Constants.VORLAUFTEMP]: { id: "/120/10101/0/0/12241", name: "Vorlauf Temperatur" },
});

export class Names2IdReader {
  private config: Record<string, string>;

  constructor(config: Record<string, string>) {
    this.config = config;
  }

  public readNames2Id(): Names2IdType {
    const filePath = this.config[ConfigKeys.F_NAMES2ID];
    
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(getDefaultNames2Id()));
    }
    
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
}

export const useLoadNames2Id = (config: Record<string, string>) => {
  const dispatch = useDispatch();
  
  const loadNames2Id = async () => {
    const reader = new Names2IdReader(config);
    const names2IdData = await reader.readNames2Id();
    dispatch(setNames2IdData(names2IdData));
  };

  return loadNames2Id;
};
