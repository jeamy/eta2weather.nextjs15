import type { WeatherDataPoint } from './weatherData';

export interface WeatherChannelPoint {
  channels?: Record<string, unknown>;
}

export function hasWeatherMeasurements(data: WeatherDataPoint[]): boolean {
  return data.some(point =>
    [point.temperature, point.humidity, point.pressure, point.indoor?.temperature, point.indoor?.humidity]
      .some(value => typeof value === 'number' && Number.isFinite(value)) ||
    Object.values(point.channels || {}).some(channel =>
      [channel.temperature, channel.humidity].some(value => typeof value === 'number' && Number.isFinite(value)),
    ),
  );
}

export function collectWeatherChannels(data: WeatherChannelPoint[]): string[] {
  const channels = new Set<string>();
  for (const point of data) {
    for (const channel of Object.keys(point.channels || {})) channels.add(channel);
  }
  return Array.from(channels).sort((a, b) => {
    const left = Number.parseInt(a.replace('ch', ''), 10) || 0;
    const right = Number.parseInt(b.replace('ch', ''), 10) || 0;
    return left - right;
  });
}

export function reconcileVisibleChannels(available: string[], selected: string[] | null): string[] {
  if (selected === null) return available.slice(0, Math.min(4, available.length));
  return selected.filter(channel => available.includes(channel));
}
