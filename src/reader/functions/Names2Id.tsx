import { setIsLoading, storeData, storeError } from '../../redux/names2IdSlice';
import { Config } from 'tailwindcss';
import { readNames2Id } from '../Names2Id';
import { AppDispatch } from '@/redux';

export const useLoadNames2Id = (dispatch: AppDispatch, config: Config) => {
  
  const loadAndStoreNames2Id = async () => {
    dispatch(setIsLoading(true));
    Promise.all([readNames2Id(config)])
      .then((response) => {
        dispatch(storeData(response[0]));
      })
      .catch((error) => {
        dispatch(storeError(error.message));
      })
      .finally(() => dispatch(setIsLoading(false)));
  };

  return loadAndStoreNames2Id;
};

