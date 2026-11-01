import { parseNum } from './numberParser';

export interface WeatherDataPoint {
  timestamp: string;
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  indoor: { temperature: number | null; humidity: number | null };
  channels: Record<string, { temperature: number; humidity: number }>;
}

export function extractWeatherChannels(data: any): Record<string, { temperature: number; humidity: number }> {
  const channels: Record<string, { temperature: number; humidity: number }> = {};
  for (const index of [1, 2, 3, 5, 6, 7, 8]) {
    const channel = data?.[`temp_and_humidity_ch${index}`];
    const temperature = parseNum(channel?.temperature?.value);
    const humidity = parseNum(channel?.humidity?.value);
    if (temperature !== null && humidity !== null) {
      channels[`ch${index}`] = { temperature, humidity };
    }
  }
  return channels;
}

export function extractWeatherPoint(timestamp: string, data: any): WeatherDataPoint {
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = null; }
  }
  let readings = data?.allData ?? data;
  if (typeof readings === 'string') {
    try { readings = JSON.parse(readings); } catch { readings = null; }
  }
  const number = (value: unknown): number | null => {
    const parsed = parseNum(value);
    return parsed !== null && Number.isFinite(parsed) ? parsed : null;
  };

  return {
    timestamp,
    temperature: number(readings?.outdoor?.temperature?.value ?? data?.temperature),
    pressure: number(readings?.pressure?.relative?.value),
    humidity: number(readings?.outdoor?.humidity?.value),
    indoor: {
      temperature: number(readings?.indoor?.temperature?.value ?? data?.indoorTemperature),
      humidity: number(readings?.indoor?.humidity?.value),
    },
    channels: extractWeatherChannels(readings),
  };
}
