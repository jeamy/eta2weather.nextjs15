import { parseNum } from './numberParser';

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
