import { setIsLoading, storeData, storeError } from '../../redux/etaSlice';
import { Names2Id } from '../Names2Id';
import { Config } from './types-constants/ConfigConstants';
import { fetchEtaData } from './server/EtaData';
import { AppDispatch } from '@/redux';

export function useEtaReadAndStore(dispatch: AppDispatch, config: Config, names2id: Names2Id) {

    const loadAndStoreEta = async () => {
        dispatch(setIsLoading(true));
        Promise.all([fetchEtaData(config, names2id)])
        .then((response) => {
            console.log(response[0]);
            dispatch(storeData(response[0]));
        })
        .catch((error) => {
            dispatch(storeError(error.message));
        })
        .finally(() => dispatch(setIsLoading(false)));
    };

    return loadAndStoreEta;
}

