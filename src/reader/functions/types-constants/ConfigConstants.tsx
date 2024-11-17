// Typdefinition für die Konfiguration
export type Config = Record<ConfigKeys, string>;

// Konstanten als Enum definieren
export enum ConfigKeys {
    T_SOLL = 't_soll',
    T_DELTA = 't_delta',
    T_SLIDER = 't_slider',
    F_ETA = 'f_eta',
    S_ETA = 's_eta',
    F_WIFIAF83 = 'f_wifiaf83',
    F_NAMES2ID = 'f_names2id',
    T_UPDATE_TIMER = 't_update_timer'
}

export const defaultConfig: Config = {
    [ConfigKeys.T_SOLL]: '22',
    [ConfigKeys.T_DELTA]: '0',
    [ConfigKeys.T_SLIDER]: '0.0',
    [ConfigKeys.F_ETA]: 'f_eta.json',
    [ConfigKeys.S_ETA]: '192.168.8.100:8080',
    [ConfigKeys.F_WIFIAF83]: 'f_wifiaf89.json',
    [ConfigKeys.F_NAMES2ID]: 'f_names2id.json',
    [ConfigKeys.T_UPDATE_TIMER]: '300000'
};
