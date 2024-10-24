'use client'

import { useDispatch } from 'react-redux';
import { setIsLoading, storeData, storeError } from '../redux/etaSlice';
import { Config } from './Config';
import { Names2Id } from './Names2Id';
import { FetchEta } from '../serverfunctions/FetchEtaServer';

export function useEtaReadAndStore(config: Config, names2id: Names2Id) {
    const dispatch = useDispatch();

    const loadAndStoreEta = async () => {
        dispatch(setIsLoading(true));
        const loadEtaData = new FetchEta(config, names2id);
        Promise.all([loadEtaData.fetchEtaData()])
        .then((response) => {
            dispatch(storeData(response[0]));
        })
        .catch((error) => {
            dispatch(storeError(error.message));
        })
        .finally(() => dispatch(setIsLoading(false)));
    };

    return loadAndStoreEta;
}

