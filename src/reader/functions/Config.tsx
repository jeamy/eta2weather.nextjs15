'use client';

import { useDispatch } from 'react-redux';
import { setIsLoading, storeData, storeError } from '../../redux/configSlice';
import { readConfig } from '../serverfunctions/Config';

export function useConfigReadAndStore(fconfig: string) {
    const dispatch = useDispatch();

    const loadAndStoreConfig = async () => {
        dispatch(setIsLoading(true));
        Promise.all([readConfig(fconfig)])
            .then((response) => {
                dispatch(storeData(response[0]));
            })
            .catch((error) => {
                dispatch(storeError(error.message));
            })
            .finally(() => dispatch(setIsLoading(false)));
    };

    return loadAndStoreConfig;
}

