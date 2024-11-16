'use server';

import { Config, ConfigKeys } from './types-constants/ConfigConstants';
import { WifiAf83Api } from './WifiAf83Api';

interface WifiAf83Response {
    temperature?: number;
    humidity?: number;
    pressure?: number;
    diff?: number;
}

export const fetchWifiAf83Data = async (config: Config): Promise<WifiAf83Response> => {
  const wifiApi = new WifiAf83Api();

    try {
        const response = await wifiApi.getRealtime();
        
        if (!response.ok) {
            throw new Error(`Failed to fetch WifiAf83 data: ${response.statusText}`);
        }

        const data = await response.json();

        console.log('WifiAf83 data:', data);

        // Transform and validate the data
        const result: WifiAf83Response = {
            temperature: parseFloat(data.temperature) || 0,
            humidity: parseFloat(data.humidity) || 0,
            pressure: parseFloat(data.pressure) || 0,
            diff: parseFloat(data.diff) || 0
        };
        
        console.log('Transformed WifiAf83 data:', result);

        return result;
    } catch (error) {
        console.error('Error fetching WifiAf83 data:', error);
        return {};
    }
};
