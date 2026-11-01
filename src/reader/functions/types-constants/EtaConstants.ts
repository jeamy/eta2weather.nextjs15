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

export function isCircuitPosition(value: unknown): value is EtaPos {
  return value === EtaPos.EIN || value === EtaPos.AUS;
}

export enum EtaText {
  EIN = "Ein",
  AUS = "Aus",
}

export enum EtaButtons {
  EAT = 'EAT',  // Ein/Aus Taste
  HT = 'HT',  // Heizen Taste
  KT = 'KT',  // Kommen Taste
  AA = 'AA',  // Auto Taste
  GT = 'GT',  // Gehen Taste
  DT = 'DT',  // Absenken Taste
}

export type EtaModeButton =
  | EtaButtons.HT
  | EtaButtons.KT
  | EtaButtons.AA
  | EtaButtons.GT
  | EtaButtons.DT;

export const ETA_MODE_LABELS: Record<EtaModeButton, string> = {
  [EtaButtons.HT]: 'Heizen',
  [EtaButtons.KT]: 'Kommen',
  [EtaButtons.AA]: 'Auto',
  [EtaButtons.GT]: 'Gehen',
  [EtaButtons.DT]: 'Absenken',
};

export const ETA_MODE_BUTTONS: readonly EtaModeButton[] = [
  EtaButtons.HT,
  EtaButtons.KT,
  EtaButtons.AA,
  EtaButtons.GT,
  EtaButtons.DT,
] as const;
