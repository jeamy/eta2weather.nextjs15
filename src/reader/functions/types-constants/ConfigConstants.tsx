// Typdefinition für die Konfiguration
export type Config = Record<ConfigKeys, string>;

// Konstanten als Enum definieren
export enum ConfigKeys {
    T_SOLL = 'T_SOLL',
    T_DELTA = 'T_DELTA',
    F_ETA = 'F_ETA',
    S_ETA = 'S_ETA',
    F_WIFIAF83 = 'F_WIFIAF83',
    F_NAMES2ID = 'F_NAMES2ID',
    T_UPDATE_TIMER = 'T_UPDATE_TIMER'
}

export const defaultConfig: Config = {
    [ConfigKeys.T_SOLL]: '22',
    [ConfigKeys.T_DELTA]: '0',
    [ConfigKeys.F_ETA]: 'f_eta.json',
    [ConfigKeys.S_ETA]: '192.168.8.100:8080',
    [ConfigKeys.F_WIFIAF83]: 'f_wifiaf89.json',
    [ConfigKeys.F_NAMES2ID]: 'f_names2id.json',
    [ConfigKeys.T_UPDATE_TIMER]: '30'
};
