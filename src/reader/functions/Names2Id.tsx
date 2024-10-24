'use client';

import { Config } from '../serverfunctions/Config';
import { useDispatch } from 'react-redux';
import { setIsLoading, storeData, storeError } from '../../redux/names2IdSlice';
import { readNames2Id } from '../serverfunctions/Names2Id';

export const useLoadNames2Id = (config: Config) => {
  const dispatch = useDispatch();
  
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

