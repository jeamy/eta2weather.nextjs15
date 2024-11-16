import { promises as fs } from 'fs';
import { storeData } from '../../redux/names2IdSlice';
import { AppDispatch } from '../../redux/index';
import { Config, ConfigKeys } from './types-constants/ConfigConstants';
import { Names2Id } from './types-constants/Names2IDconstants';

export const fetchNames2IdData = async (config: Config, dispatch: AppDispatch): Promise<Names2Id> => {
  const filePath = config[ConfigKeys.F_NAMES2ID];
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const names2IdData: Names2Id = JSON.parse(data);
    dispatch(storeData(names2IdData));
    return names2IdData;
  } catch (error) {
    console.error('Error reading Names2Id data:', error);
    throw error;
  }
};
