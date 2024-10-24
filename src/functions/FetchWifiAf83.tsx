'use client'

import { Config} from "../serverfunctions/ConfigServer";
import { useDispatch } from "react-redux";
import { setIsLoading, storeData, storeError } from "../redux/wifiAf83Slice";
import { FetchWifiAf83 } from "../serverfunctions/FetchWifiAf83Server";

export function useWifiReadAndStore(config: Config) {
    const dispatch = useDispatch();

    const loadAndStoreWifi = async () => {
        dispatch(setIsLoading(true));
        const loadWifiData = new FetchWifiAf83(config);
        Promise.all([loadWifiData.fetchWifiAF83Data()])
        .then((response) => {
            dispatch(storeData(response[0]));   
        })  
        .catch((error) => {
            dispatch(storeError(error.message));    
        })  
        .finally(() => dispatch(setIsLoading(false)));  
    };

    return loadAndStoreWifi;
}

