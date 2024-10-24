'use client'

import { Config} from "../serverfunctions/Config";
import { useDispatch } from "react-redux";
import { setIsLoading, storeData, storeError } from "../../redux/wifiAf83Slice";
import { fetchWifiAF83Data } from "../serverfunctions/FetchWifiAf83";

export function useWifiReadAndStore(config: Config) {
    const dispatch = useDispatch();

    const loadAndStoreWifi = async () => {
        dispatch(setIsLoading(true));
        
        Promise.all([fetchWifiAF83Data(config)])
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

