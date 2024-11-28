// Neue Typdefinitionen
export type ParsedXmlData = Record<string, string>;
export type EtaData = Record<string, ParsedXmlData>;

export enum EtaPos {
    EIN = "1803",
    AUS = "1802",
}

export enum EtaText {
    EIN = "Ein",
    AUS = "Aus",
}