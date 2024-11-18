import fs from 'fs';
import path from 'path';
import { Config, defaultConfig } from '../reader/functions/types-constants/ConfigConstants';
import { storeData } from '../redux/configSlice';
import { AppDispatch } from '../redux/index';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');

export const loadConfig = (dispatch: AppDispatch) => {
  try {
    let configData: Config;

    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      console.log('Config file does not exist. Creating with default values.');
      // If file doesn't exist, create it with default values
      configData = defaultConfig;
      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(defaultConfig, null, 2));
    } else {
      try {
        // Try to read and parse existing config
        const rawData = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
        configData = JSON.parse(rawData);
      } catch (parseError) {
        // If reading or parsing fails, use default values but don't overwrite file
        console.error('Error reading/parsing config file:', parseError);
        configData = defaultConfig;
      }
    }

    dispatch(storeData(configData));
  } catch (error) {
    console.error('Error in loadConfig:', error);
    // In case of any other error, use default values
    dispatch(storeData(defaultConfig));
  }
};
