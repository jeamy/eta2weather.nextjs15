interface MeasurementData {
  time: string;
  unit: string;
  value: string;
}

interface ChannelData {
  temperature: MeasurementData;
  humidity: MeasurementData;
}

interface BatteryData {
  t_rh_p_sensor: MeasurementData;
  sensor_array: MeasurementData;
  temp_humidity_sensor_ch1: MeasurementData;
  temp_humidity_sensor_ch2: MeasurementData;
  temp_humidity_sensor_ch3: MeasurementData;
  temp_humidity_sensor_ch5: MeasurementData;
  temp_humidity_sensor_ch6: MeasurementData;
  temp_humidity_sensor_ch7: MeasurementData;
  temp_humidity_sensor_ch8: MeasurementData;
}

export interface WifiData {
  outdoor: {
    temperature: MeasurementData;
    feels_like: MeasurementData;
    app_temp: MeasurementData;
    dew_point: MeasurementData;
    humidity: MeasurementData;
  };
  indoor: {
    temperature: MeasurementData;
    humidity: MeasurementData;
  };
  solar_and_uvi: {
    solar: MeasurementData;
    uvi: MeasurementData;
  };
  rainfall: {
    rain_rate: MeasurementData;
    daily: MeasurementData;
    event: MeasurementData;
    hourly: MeasurementData;
    weekly: MeasurementData;
    monthly: MeasurementData;
    yearly: MeasurementData;
  };
  wind: {
    wind_speed: MeasurementData;
    wind_gust: MeasurementData;
    wind_direction: MeasurementData;
  };
  pressure: {
    relative: MeasurementData;
    absolute: MeasurementData;
  };
  temp_and_humidity_ch1: ChannelData;
  temp_and_humidity_ch2: ChannelData;
  temp_and_humidity_ch3: ChannelData;
  temp_and_humidity_ch5: ChannelData;
  temp_and_humidity_ch6: ChannelData;
  temp_and_humidity_ch7: ChannelData;
  temp_and_humidity_ch8: ChannelData;
  battery: BatteryData;
}
