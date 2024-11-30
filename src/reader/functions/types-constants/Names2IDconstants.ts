
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
    AUTOTASTE = 'AA',
//    KOMMENTASTE = 'KT',
    ABSENKTASTE = 'DT',
    VORLAUFTEMP = 'VT',
  }
  
  export type Names2Id = Record<string, { id: string; name: string }>;
  
  // defaultNames2id 
  export const defaultNames2Id: Names2Id = {
    [EtaConstants.HEIZKURVE]: { id: "/120/10101/0/0/12111", name: "Heizkurve" },
    [EtaConstants.SCHIEBERPOS]: { id: "/120/10101/0/0/12240", name: "Schieber Position" },
    [EtaConstants.AUSSENTEMP]: { id: "/120/10101/0/0/12197", name: "Außentemperatur" },
    [EtaConstants.VORRAT]: { id: "/40/10201/0/0/12015", name: "Vorrat" },
    [EtaConstants.INHALT_PELLETS_BEHALTER]: { id: "/40/10021/0/0/12011", name: "Inhalt Pelletsbehälter" },
    [EtaConstants.SCHALTZUSTAND]: { id: "/120/10101/12113/0/1109", name: "Schaltzustand" },
    [EtaConstants.EIN_AUS_TASTE]: { id: "/120/10101/0/0/12080", name: "Ein/Aus Taste" },
    [EtaConstants.KESSELTEMP]: { id: "/40/10021/0/11109/0", name: "Kessel Temperatur" },
    [EtaConstants.HEIZENTASTE]: { id: "/120/10101/0/0/12125", name: "Heizen Taste" },
    [EtaConstants.AUTOTASTE]: { id: "/120/10101/0/0/12126", name: "Autotaste" },
//    [EtaConstants.KOMMENTASTE]: { id: "/120/10101/0/0/12218", name: "Kommen Taste" },
    [EtaConstants.ABSENKTASTE]: { id: "/120/10101/0/0/12230", name: "Absenken Taste" },
    [EtaConstants.VORLAUFTEMP]: { id: "/120/10101/0/0/12241", name: "Vorlauf Temperatur" },
  };
  