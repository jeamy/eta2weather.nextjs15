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
        console.log('WifiAf83 raw data:', response);

        if (!response || response.code !== 0) {
            throw new Error(`Failed to fetch WifiAf83 data: ${response?.msg || 'Unknown error'}`);
        }

        const data = response as WifiAf83ApiResponse;

        // Transform and validate the data
        const result: WifiAF83Data = {
            time: parseInt(data.time) * 1000, // Convert to milliseconds
            datestring: data.datestring,
            temperature: parseFloat(data.data.outdoor.temperature.value) || 0,
            indoorTemperature: parseFloat(data.data.indoor.temperature.value) || 0,
            diff: parseFloat(data.diff) || 0
        };

        // console.log('Transformed WifiAf83 data:', result);
        return result;
    } catch (error) {
        console.error('Error fetching WifiAf83 data:', error);
        return {
            time: Date.now(),
            datestring: new Date().toLocaleString('de-DE'),
            temperature: 0,
            indoorTemperature: 0,
            diff: 0
        };
    }
};
