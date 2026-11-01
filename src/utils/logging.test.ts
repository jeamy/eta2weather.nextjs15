import { formatLogData } from './logging';
import { getLogExtension, isLogType } from '@/lib/logTypes';
import { extractWeatherChannels, extractWeatherPoint } from './weatherData';
import { normalizeNames2Id } from './cache';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

const timestamp = new Date('2026-08-23T12:00:00.000Z');
const etaXml = formatLogData('eta', {
  '/test': { id: '/test', value: '1 & 2', strValue: '<active>', short: 'T' },
}, timestamp);
assert(etaXml.includes('1 &amp; 2'), 'ETA log XML escapes text content');
assert(etaXml.includes('&lt;active&gt;'), 'ETA log XML escapes attribute-derived values');

const jsonl = formatLogData('temp_diff', { diff: 1.5 }, timestamp);
assert(JSON.parse(jsonl).timestamp === timestamp.toISOString(), 'JSONL logs retain their database timestamp');
assert(isLogType('min_temp_status') && !isLogType('unknown'), 'log types are centrally validated');
assert(getLogExtension('config') === 'json', 'log extensions are centrally mapped');

const channels = extractWeatherChannels({
  temp_and_humidity_ch1: {
    temperature: { value: '21.5' },
    humidity: { value: '48' },
  },
  temp_and_humidity_ch2: {
    temperature: { value: 'invalid' },
    humidity: { value: '50' },
  },
});
assert(channels.ch1.temperature === 21.5, 'weather channel values are parsed once through the shared helper');
assert(!channels.ch2, 'invalid weather channels are omitted');

const wrapper = { temperature: 0, indoorTemperature: 0, allData: null };
const fallback = extractWeatherPoint('time', wrapper);
assert(fallback.temperature === 0 && fallback.indoor.temperature === 0, 'missing allData falls back to recorded temperatures including zero');
assert(fallback.pressure === null && fallback.humidity === null, 'missing weather readings are not converted to zero');
const encoded = extractWeatherPoint('time', JSON.stringify({
  allData: JSON.stringify({ outdoor: { temperature: { value: '10,2' } } }),
}));
assert(encoded.temperature === 10.2, 'double-encoded historical weather data is parsed');

const names = normalizeNames2Id({ AT: { id: '120/10101/0/0/12197', name: 'Outdoor' } });
assert(names.AT.id === '/120/10101/0/0/12197', 'names2id identifiers use one canonical leading slash');
