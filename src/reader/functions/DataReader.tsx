'use client'
import { useDispatch } from 'react-redux';
import { setIsLoading, storeData, storeError } from '../../redux/dataSlice';
import { readData } from '../serverfunctions/DataReader';

// Funktion, um Daten abzurufen und im Store zu speichern
export const useDataReadAndStore = (fdata: string) => {
    const dispatch = useDispatch();
    
    const loadAndStoreData = async () => {
      dispatch(setIsLoading(true));

      Promise.all([readData(fdata)])
        .then((response) => {
          dispatch(storeData(response[0]));
        })
        .catch((error) => {
          dispatch(storeError(error.message));    
        }).finally(() => {
          dispatch(setIsLoading(false));
        })  
    };
    return loadAndStoreData;
  };