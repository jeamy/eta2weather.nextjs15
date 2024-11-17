'use server';

import { WifiAf83Api } from './WifiAf83Api';
import { WifiAF83Data } from './types-constants/WifiAf83';

interface Temperature {
    time: string;
    unit: string;
    value: string;
}

interface WifiAf83ApiResponse {
    code: number;
    msg: string;
    time: string;
    data: {
        outdoor: {
            temperature: Temperature;
        };
        indoor: {
            temperature: Temperature;
        };
    };
    datestring: string;
    diff: string;
}

export const fetchWifiAf83Data = async (): Promise<WifiAF83Data> => {
    const wifiApi = new WifiAf83Api();

    try {
        const response = await wifiApi.getRealtime();
        console.log('WifiAf83 raw data:', JSON.stringify(response, null, 2));

        if (!response || response.code !== 0) {
            throw new Error(`Failed to fetch WifiAf83 data: ${response?.msg || 'Unknown error'}`);
        }

        const data = response as WifiAf83ApiResponse;
/*        
        console.log('WifiAf83 data structure:', {
            outdoor: data.data?.outdoor?.temperature,
            indoor: data.data?.indoor?.temperature
        });
*/
        // Transform and validate the data
        const outdoorTemp = data.data?.outdoor?.temperature?.value;
        const indoorTemp = data.data?.indoor?.temperature?.value;

//        console.log('Raw temperature values:', { outdoorTemp, indoorTemp });

        const temperature = outdoorTemp ? parseFloat(outdoorTemp) : null;
        const indoorTemperature = indoorTemp ? parseFloat(indoorTemp) : null;

        if (temperature === null || indoorTemperature === null) {
            console.error('Missing temperature values:', {
                outdoor: outdoorTemp,
                indoor: indoorTemp
            });
            throw new Error('Missing temperature values');
        }

        if (isNaN(temperature) || isNaN(indoorTemperature)) {
            console.error('Invalid temperature values:', {
                outdoor: outdoorTemp,
                indoor: indoorTemp
            });
            throw new Error('Invalid temperature values');
        }

        const result: WifiAF83Data = {
            time: parseInt(data.time) * 1000, // Convert to milliseconds
            datestring: data.datestring,
            temperature,
            indoorTemperature,
            diff: parseFloat(data.diff) || 0
        };

        console.log('Transformed WifiAf83 data:', result);
        return result;
    } catch (error) {
        console.error('Error fetching WifiAf83 data:', error);
        throw error;
    }
};
