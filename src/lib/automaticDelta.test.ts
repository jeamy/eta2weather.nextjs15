import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ConfigKeys, defaultConfig } from '@/reader/functions/types-constants/ConfigConstants';
import { calculateTemperatureDiff } from '@/utils/Functions';
import { calculateAutomaticDelta } from './automaticDelta';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

async function main(): Promise<void> {
  const config = { ...defaultConfig, t_delta: '0.0' };
  assert(calculateAutomaticDelta(config, '1,8 °C', 6.7) === '-4.9', 'auto delta uses ETA minus WiFi, including negative values and decimal commas');
  assert(calculateAutomaticDelta(config, '4.5 °C', 2) === '2.5', 'auto delta preserves positive differences');
  assert(calculateAutomaticDelta(config, '7 °C', 2) === '5.0', 'the safety limit includes exactly 5 degrees');
  assert(calculateAutomaticDelta(config, '7.01 °C', 2) === null, 'values beyond the safety limit are rejected before rounding');
  assert(calculateAutomaticDelta(config, 'N/A', 2) === null, 'invalid ETA values do not replace the delta');
  assert(calculateAutomaticDelta(config, undefined, 2) === null, 'missing ETA values do not replace the delta');
  assert(calculateAutomaticDelta(config, '2', NaN) === null, 'invalid WiFi values do not replace the delta');
  assert(calculateAutomaticDelta(config, '2.1', 2) === null, 'changes of 0.1 degrees are ignored');
  assert(calculateAutomaticDelta(config, '2.2', 2) === '0.2', 'changes greater than 0.1 degrees are applied');
  assert(calculateAutomaticDelta({ ...config, delta_override: 'true' }, '1.8', 6.7) === null, 'manual delta override prevents automatic updates');

  const directory = await mkdtemp(path.join(os.tmpdir(), 'eta-delta-test-'));
  const configPath = path.join(directory, 'config.json');
  process.env.CONFIG_PATH = configPath;
  try {
    await writeFile(configPath, JSON.stringify(config));
    const { BackgroundService } = await import('./backgroundService');
    const { getConfig, updateConfig, getWifiAf83Data, wifiaf83Cache, WIFIAF83_CACHE_KEY } = await import('@/utils/cache');
    const { store } = await import('@/redux/store');
    const service = BackgroundService.getInstance() as unknown as {
      updateAutomaticDelta: (etaOutdoor: string | undefined, wifiOutdoor: number) => Promise<void>;
    };

    await service.updateAutomaticDelta('1,8 °C', 6.7);
    assert((await getConfig(true)).t_delta === '-4.9', 'background update persists the signed raw delta');
    assert(store.getState().config.data.t_delta === '-4.9', 'background update publishes the delta before control recomputation');
    const diff = calculateTemperatureDiff(store.getState().config, {
      data: { time: 1, datestring: '', temperature: 6.7, indoorTemperature: 21.3, allData: null },
      loadingState: { isLoading: false, error: null },
    });
    assert(diff.diff === -0.28, 'the updated raw delta is dampened exactly once in the control calculation');

    await service.updateAutomaticDelta(undefined, 3);
    assert((await getConfig(true)).t_delta === '-4.9', 'missing fresh ETA data keeps the previous persisted delta');
    await service.updateAutomaticDelta('15', 3);
    assert((await getConfig(true)).t_delta === '-4.9', 'out-of-range sensor differences keep the previous persisted delta');

    await Promise.all([
      updateConfig({ [ConfigKeys.DELTA_OVERRIDE]: 'true', [ConfigKeys.T_DELTA]: '1.5' }),
      service.updateAutomaticDelta('3', 2),
    ]);
    const manualConfig = JSON.parse(await readFile(configPath, 'utf8'));
    assert(manualConfig.t_delta === '1.5', 'a queued manual override cannot be overwritten by an automatic update');

    await updateConfig({ [ConfigKeys.DELTA_OVERRIDE]: 'false' });
    await service.updateAutomaticDelta('3', 2);
    assert((await getConfig(true)).t_delta === '1.0', 'automatic updates resume after manual override is disabled');

    const sensorTime = String(Math.floor(Date.now() / 1000));
    const cachedWifi = {
      outdoor: { temperature: { value: 3, time: sensorTime } },
      indoor: { temperature: { value: 21, time: sensorTime } },
    };
    wifiaf83Cache.set(WIFIAF83_CACHE_KEY, cachedWifi);
    let fallbackUsed = false;
    const wifi = await getWifiAf83Data(
      async () => { throw new Error('offline'); },
      undefined,
      { forceRefresh: true, onFallback: () => { fallbackUsed = true; } },
    );
    assert(wifi === cachedWifi && fallbackUsed, 'a failed WiFi refresh signals that the returned reading is stale');
    let cachedFallbackUsed = false;
    await getWifiAf83Data(
      async () => { throw new Error('unexpected network request'); },
      undefined,
      { onFallback: () => { cachedFallbackUsed = true; } },
    );
    assert(cachedFallbackUsed, 'subsequent cache reads retain the stale fallback status');

    const { GET: readWifi } = await import('@/app/api/wifiaf83/read/route');
    const wifiResponse = await readWifi(new Request('http://localhost/api/wifiaf83/read'));
    const wifiBody = await wifiResponse.json();
    assert(wifiBody.data.stale === true, 'WiFi read API marks cached fallback data as stale');
    assert(wifiBody.data.time === Number(sensorTime) * 1000, 'WiFi read API preserves the sensor timestamp');

    const { GET: readAllWifi } = await import('@/app/api/wifiaf83/all/route');
    const allWifiResponse = await readAllWifi(new Request('http://localhost/api/wifiaf83/all'));
    const allWifiBody = await allWifiResponse.json();
    assert(allWifiBody.stale === true, 'full WiFi API marks cached fallback data as stale');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

void main();
