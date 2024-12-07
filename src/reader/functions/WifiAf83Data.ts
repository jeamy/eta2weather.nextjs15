'use server';

import { WifiAf83Api } from './WifiAf83Api';
import { WifiAF83Data } from './types-constants/WifiAf83';

interface Temperature {
    time: string;
    unit: string;
    value: string;
}

interface Measurement {
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
            feels_like: Measurement;
            app_temp: Measurement;
            dew_point: Measurement;
            humidity: Measurement;
        };
        indoor: {
            temperature: Temperature;
            humidity: Measurement;
        };
        solar_and_uvi: {
            solar: Measurement;
            uvi: Measurement;
        };
        rainfall: {
            rain_rate: Measurement;
            daily: Measurement;
            event: Measurement;
            hourly: Measurement;
            weekly: Measurement;
            monthly: Measurement;
            yearly: Measurement;
        };
        wind: {
            wind_speed: Measurement;
            wind_gust: Measurement;
            wind_direction: Measurement;
            wind_direction_cardinal: Measurement;
        };
        pressure: {
            relative: Measurement;
            absolute: Measurement;
        };
        battery: {
            t_rh_p_sensor: Measurement;
            sensor_array: Measurement;
            temp_humidity_sensor_ch1: Measurement;
            temp_humidity_sensor_ch2: Measurement;
            temp_humidity_sensor_ch3: Measurement;
            temp_humidity_sensor_ch5: Measurement;
            temp_humidity_sensor_ch6: Measurement;
            temp_humidity_sensor_ch7: Measurement;
            temp_humidity_sensor_ch8: Measurement;
        };
    };
    datestring: string;
}

export const fetchWifiAf83Data = async (): Promise<WifiAF83Data> => {
    const wifiApi = new WifiAf83Api();

    try {
        const response = await wifiApi.getRealtime();

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
            time: Date.parse(data.time),
            datestring: data.datestring,
            temperature: temperature || 0,
            indoorTemperature: indoorTemperature || 0,
            allData: null
        };

//        console.log('Transformed WifiAf83 data:', result);
        return result;
    } catch (error) {
        console.error('Error fetching WifiAf83 data:', error);
        throw error;
    }
};
