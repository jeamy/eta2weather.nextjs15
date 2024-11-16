import { promises as fs } from 'fs';
import { storeData } from '../../redux/wifiAf83Slice';
import { AppDispatch } from '../../redux/index';
import { Config, ConfigKeys } from './types-constants/ConfigConstants';
import { WifiAF83Data } from './types-constants/WifiAf83';
import { WifiAf83Api } from './WifiAf83Api';

export const fetchWifiAf83Data = async (config: Config, dispatch: AppDispatch): Promise<WifiAF83Data> => {
  const wifiAf83Api = new WifiAf83Api();
  const data: WifiAF83Data = await wifiAf83Api.getRealtime();

  await writeData(data, config);
  dispatch(storeData(data));

  return data;
};

const writeData = async (data: WifiAF83Data, config: Config): Promise<void> => {
  const filePath = config[ConfigKeys.F_WIFIAF83];
  const jsonData = JSON.stringify(data);

  try {
    await fs.writeFile(filePath, jsonData);
  } catch (error) {
    console.error('Error writing WifiAf83 data to file:', error);
  }
};
