// Neue Typdefinitionen
export interface ParsedXmlData {
  id: string;
  parentId: string | null;
  value: string;
  strValue: string;
  unit?: string;
  long?: string;
  short?: string;
  text?: string;
  type?: string;
  uri?: string;
  scaleFactor?: string;
  decPlaces?: string;
  advTextOffset?: string;
  [key: string]: string | null | undefined;  // Allow additional string properties
}

export type EtaData = Record<string, ParsedXmlData>;

export enum EtaPos {
  EIN = "1803",
  AUS = "1802",
}

export enum EtaText {
  EIN = "Ein",
  AUS = "Aus",
}

export enum EtaButtons {
  HT = 'HT',  // Heizen Taste
  KT = 'KT',  // Kommen Taste
  AA = 'AA',  // Auto Taste
  GT = 'GT',  // Gehen Taste
  DT = 'DT',  // Absenken Taste
}