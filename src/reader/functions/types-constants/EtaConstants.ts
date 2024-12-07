// Neue Typdefinitionen
export interface ParsedXmlData {
  id: string;
  parentId: string | null;
  value: string;
  unit?: string;
  strValue?: string;
  long?: string;
  short?: string;
  text?: string;
  type?: string;
  uri?: string;
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