interface Categories {
    [key: string]: string;
}

interface Measurements {
    [key: string]: string;
}

interface Translations {
    categories: Categories;
    measurements: Measurements;
}

export const deTranslations: Translations = {
    categories: {
        'Outdoor': 'Außen',
        'Indoor': 'Innen',
        'Channels': 'Kanäle',
        'Solar & UVI': 'Solar & UV-Index',
        'Rainfall': 'Niederschlag',
        'Wind': 'Wind',
        'Pressure': 'Luftdruck',
        'Battery': 'Batterie'
    },
    measurements: {
        // Categories and subcategories
        'outdoor': 'Außen',
        'indoor': 'Innen',
        'solar_and_uvi': 'Solar & UV-Index',
        'rainfall': 'Niederschlag',
        'wind': 'Wind',
        'pressure': 'Luftdruck',
        'battery': 'Batterie',

        // Basic measurements
        'temperature': 'Temperatur',
        'humidity': 'Luftfeuchtigkeit',
        'signal': 'Signal',

        // Outdoor specific
        'feels_like': 'Gefühlt',
        'app_temp': 'Gefühlte Temperatur',
        'dew_point': 'Taupunkt',

        // Rain measurements
        'rain_rate': 'Niederschlag Rate',
        'daily': 'Täglich',
        'hourly': 'Stündlich',
        'weekly': 'Wöchentlich',
        'monthly': 'Monatlich',
        'yearly': 'Jährlich',
        'event': 'Ereignis',

        // Wind measurements
        'wind_speed': 'Windgeschwindigkeit',
        'wind_gust': 'Windböen',
        'wind_direction': 'Windrichtung',

        // Solar measurements
        'solar': 'Solar',
        'uvi': 'UV-Index',

        // Pressure measurements
        'relative': 'Relativer Luftdruck',
        'absolute': 'Absoluter Luftdruck',

        // Battery status
        't_rh_p_sensor': 'T/RH/P Sensor',
        'sensor_array': 'Sensor Array',
        'temp_humidity_sensor': 'Temperatur/Feuchte Sensor'
    }
};
