'use client';

import { Config } from '../serverfunctions/ConfigServer';
import { useDispatch } from 'react-redux';
import { setIsLoading, storeData, storeError } from '../redux/names2IdSlice';
import { Names2IdReader } from '@/serverfunctions/Names2IdServer';

export const useLoadNames2Id = (config: Config) => {
  const dispatch = useDispatch();
  
  const loadAndStoreNames2Id = async () => {
    dispatch(setIsLoading(true));
    const reader = new Names2IdReader(config);
    Promise.all([reader.readNames2Id()])
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

