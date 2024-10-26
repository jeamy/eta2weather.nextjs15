import { setIsLoading, storeData, storeError } from "../../redux/wifiAf83Slice";
import { AppDispatch } from "@/redux";
import { Config } from "./types-constants/ConfigConstants";
import { fetchWifiAF83Data } from "../WifiAf83";

export function useWifiReadAndStore(dispatch: AppDispatch, config: Config) {
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

