import fs from 'fs';
import path from 'path';
import { Names2Id, defaultNames2Id } from '../reader/functions/types-constants/Names2IDconstants';
import { storeData } from '../redux/names2IdSlice';
import { AppDispatch } from '../redux/index';

const NAMES2ID_FILE_PATH = path.join(process.cwd(), 'src', 'config', 'f_names2id.json');

export const loadNames2Id = (dispatch: AppDispatch) => {
  try {
    if (!fs.existsSync(NAMES2ID_FILE_PATH)) {
      fs.writeFileSync(NAMES2ID_FILE_PATH, JSON.stringify(defaultNames2Id, null, 2));
    }

    const names2IdData: Names2Id = JSON.parse(fs.readFileSync(NAMES2ID_FILE_PATH, 'utf-8'));
    dispatch(storeData(names2IdData));
  } catch (error) {
    console.error('Error loading Names2Id:', error);
  }
};
