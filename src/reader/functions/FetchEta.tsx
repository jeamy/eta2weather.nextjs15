'use client'

import { useDispatch } from 'react-redux';
import { setIsLoading, storeData, storeError } from '../../redux/etaSlice';
import { Config } from '../serverfunctions/Config';
import { Names2Id } from '../serverfunctions/Names2Id';
import { fetchEtaData } from '../serverfunctions/FetchEta';

export function useEtaReadAndStore(config: Config, names2id: Names2Id) {
    const dispatch = useDispatch();

    const loadAndStoreEta = async () => {
        dispatch(setIsLoading(true));
        Promise.all([fetchEtaData(config, names2id)])
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

