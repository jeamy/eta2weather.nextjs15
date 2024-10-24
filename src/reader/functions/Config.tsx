import { setIsLoading, storeData, storeError } from '../../redux/configSlice';
import { readConfig } from '../serverfunctions/Config';

export function useConfigReadAndStore(store: any, fconfig: string) {

    const loadAndStoreConfig = async () => {
        store.dispatch(setIsLoading(true));
        Promise.all([readConfig(fconfig)])
            .then((response) => {
                store.dispatch(storeData(response[0]));
            })
            .catch((error) => {
                store.dispatch(storeError(error.message));
            })
            .finally(() => store.dispatch(setIsLoading(false)));
    };

    return loadAndStoreConfig;
}

