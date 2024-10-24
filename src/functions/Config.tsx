import * as fs from 'fs';
import { useDispatch } from 'react-redux';
import { setIsLoading, storeData, storeError } from '../redux/configSlice';


// Konstanten als Enum definieren
export enum ConfigKeys {
    T_SOLL = 'T_SOLL',
    T_DELTA = 'T_DELTA',
    F_ETA = 'F_ETA',
    S_ETA = 'S_ETA',
    F_WIFIAF83 = 'F_WIFIAF83',
    F_NAMES2ID = 'F_NAMES2ID'
}

// Typdefinition für die Konfiguration
export type Config = Record<ConfigKeys, string>;

export const defaultConfig: Config = {
    [ConfigKeys.T_SOLL]: '22',
    [ConfigKeys.T_DELTA]: '0',
    [ConfigKeys.F_ETA]: 'f_eta.json',
    [ConfigKeys.S_ETA]: '192.168.8.100:8080',
    [ConfigKeys.F_WIFIAF83]: 'f_wifiaf89.json',
    [ConfigKeys.F_NAMES2ID]: 'f_names2id.json'
};

export class ConfigReader {
    private readonly fconfig: string;

    constructor(fconfig: string) {
        this.fconfig = fconfig;
    }

    public async readConfig(): Promise<Config> {
        if (!fs.existsSync(this.fconfig)) {
            fs.writeFileSync(this.fconfig, JSON.stringify(defaultConfig));
        }
        const configFileContent = fs.readFileSync(this.fconfig, 'utf8');
        const result = JSON.parse(configFileContent) as Config;
        return result;
    }
}

export function useConfigReadAndStore(fconfig: string) {
    const dispatch = useDispatch();

    const loadAndStoreConfig = async () => {
        dispatch(setIsLoading(true));
        const configReader = new ConfigReader(fconfig);

        Promise.all([configReader.readConfig()])
            .then((response) => {
                dispatch(storeData(response[0]));
            })
            .catch((error) => {
                dispatch(storeError(error.message));
            })
            .finally(() => dispatch(setIsLoading(false)));
    };

    return loadAndStoreConfig;
}

