// Typdefinition für die Konfiguration
export type Config = {
    [ConfigKeys.T_SOLL]: string;
    [ConfigKeys.T_DELTA]: string;
    [ConfigKeys.T_SLIDER]: string;
    [ConfigKeys.F_ETA]: string;
    [ConfigKeys.S_ETA]: string;
    [ConfigKeys.F_WIFIAF83]: string;
    [ConfigKeys.F_NAMES2ID]: string;
    [ConfigKeys.T_UPDATE_TIMER]: string;
    [ConfigKeys.DIFF]: string;
    [ConfigKeys.T_MIN]: string;
    [ConfigKeys.TEMP_DIFF]: string;
    [ConfigKeys.T_OVERRIDE]: string;
    [ConfigKeys.DELTA_OVERRIDE]: string;
    [ConfigKeys.CHANNEL_NAMES]: {
        [key: string]: string;
    };
};

// Konstanten als Enum definieren
export enum ConfigKeys {
    T_SOLL = 't_soll',
    T_DELTA = 't_delta',
    T_SLIDER = 't_slider',
    F_ETA = 'f_eta',
    S_ETA = 's_eta',
    F_WIFIAF83 = 'f_wifiaf83',
    F_NAMES2ID = 'f_names2id',
    T_UPDATE_TIMER = 't_update_timer',
    DIFF = 'diff',
    T_MIN = 't_min',
    TEMP_DIFF = 'temp_diff',
    T_OVERRIDE = 't_override',
    DELTA_OVERRIDE = 'delta_override',
    CHANNEL_NAMES = 'channelNames'
}

export const defaultConfig: Config = {
    [ConfigKeys.T_SOLL]: '22',
    [ConfigKeys.T_DELTA]: '0',
    [ConfigKeys.T_SLIDER]: '0.0',
    [ConfigKeys.F_ETA]: 'f_eta.json',
    [ConfigKeys.S_ETA]: '192.168.8.100:8080',
    [ConfigKeys.F_WIFIAF83]: 'f_wifiaf89.json',
    [ConfigKeys.F_NAMES2ID]: 'f_names2id.json',
    [ConfigKeys.T_UPDATE_TIMER]: '300000',
    [ConfigKeys.DIFF]: '0',
    [ConfigKeys.T_MIN]: '16',
    [ConfigKeys.TEMP_DIFF]: '0',
    [ConfigKeys.T_OVERRIDE]: '600000',
    [ConfigKeys.DELTA_OVERRIDE]: 'false',
    [ConfigKeys.CHANNEL_NAMES]: {
        'CH1': 'Channel 1',
        'CH2': 'Channel 2',
        'CH3': 'Channel 3',
        'CH4': 'Channel 4',
        'CH5': 'Channel 5',
        'CH6': 'Channel 6',
        'CH7': 'Channel 7',
        'CH8': 'Channel 8'
    }
};

// Temperature calculation constants
export const TEMP_CALC_CONSTANTS = {
    /**
     * Delta dampening factor for temperature difference calculation.
     * Used in: (t_soll + t_delta / DELTA_DAMPENING_FACTOR) - indoorTemperature
     * 
     * Higher values = less aggressive temperature correction
     * Lower values = more aggressive temperature correction
     * 
     * Default: 5.0 (dampens delta by 80%)
     */
    DELTA_DAMPENING_FACTOR: 5.0
} as const;
