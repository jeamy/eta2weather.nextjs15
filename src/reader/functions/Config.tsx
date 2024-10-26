import { AppDispatch } from '@/redux';
import { setIsLoading, storeData, storeError } from '../../redux/configSlice';
import { readConfig } from './server/Config';

export async function useConfigReadAndStore(dispatch: AppDispatch, fconfig: string) {

    const loadAndStoreConfig = async () => {
        dispatch(setIsLoading(true));
        Promise.all([readConfig(fconfig)])
            .then((response) => {
                console.log(response[0]);
                dispatch(storeData(response[0]));
            })
            .catch((error) => {
                dispatch(storeError(error.message));
            })
            .finally(() => dispatch(setIsLoading(false)));
    };

    return loadAndStoreConfig;
}

