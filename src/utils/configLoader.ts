import fs from 'fs';
import path from 'path';
import { Config, defaultConfig } from '../reader/functions/types-constants/ConfigConstants';
import { storeData } from '../redux/configSlice';
import { AppDispatch } from '../redux/index';

const CONFIG_FILE_PATH = path.join(process.cwd(), 'src', 'config', 'f_etacfg.json');

export const loadConfig = (dispatch: AppDispatch) => {
  try {
    if (!fs.existsSync(CONFIG_FILE_PATH)) {
      fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(defaultConfig, null, 2));
    }

    const configData: Config = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf-8'));
    dispatch(storeData(configData));
  } catch (error) {
    console.error('Error loading config:', error);
  }
};
