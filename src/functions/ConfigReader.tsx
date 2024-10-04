import * as fs from 'fs';

const T_SOLL = 'T_SOLL';
const T_DELTA = 'T_DELTA';
const F_ETA = 'F_ETA';
const F_WIFIAF83 = 'F_WIFIAF83';
const F_NAMES2ID = 'F_NAMES2ID';

const defaultConfig: { [key: string]: string } = {
    [T_SOLL]: '22',
    [T_DELTA]: '0',
    [F_ETA]: 'f_eta.json',
    [F_WIFIAF83]: 'f_wifiaf89.json',
    [F_NAMES2ID]: 'f_names2id.json'
};

class ConfigReader {
    // config filename
    private fconfig: string;

    /**
     * Construct a new ConfigReader object.
     * @param fconfig The filename of the configuration to read.
     */
    constructor(fconfig: string) {
        this.fconfig = fconfig;
    }

    /**
     * Reads the configuration file and returns the configuration as an object.
     * If the file does not exist, it is created with the default configuration.
     * @returns The configuration as an object.
     */
    public readConfig(): string[] {
        if (!fs.existsSync(this.fconfig)) {
            fs.writeFileSync(this.fconfig, JSON.stringify(defaultConfig));
        }
        const configFileContent: string = fs.readFileSync(this.fconfig, 'utf8');
        const config: string[] = JSON.parse(configFileContent);
        return config;
    }
}
export default ConfigReader;