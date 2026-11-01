import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BackgroundService } from './backgroundService';
import { determineControlAction } from './controlLogic';
import { getHeatingButtonIds, setHeatingMode } from './heatingMode';
import { EtaApi } from '@/reader/functions/EtaApi';
import { EtaButtons, EtaData, EtaModeButton, EtaPos } from '@/reader/functions/types-constants/EtaConstants';
import { defaultConfig } from '@/reader/functions/types-constants/ConfigConstants';
import { defaultNames2Id } from '@/reader/functions/types-constants/Names2IDconstants';
import { store } from '@/redux/store';
import { storeData as storeConfigData } from '@/redux/configSlice';
import { storeData as storeEtaData } from '@/redux/etaSlice';
import { storeData as storeWifiData } from '@/redux/wifiAf83Slice';
import { MenuNode } from '@/types/menu';
import { checkHeatingTime, isTimeInWindow } from '@/utils/etaUtils';

test('ordinary time windows use Vienna time and exclude the end', () => {
  assert.equal(isTimeInWindow('06:00', '08:00', new Date('2026-06-02T04:30:00Z')), true);
  assert.equal(isTimeInWindow('06:00', '08:00', new Date('2026-06-02T06:00:00Z')), false);
});

test('Monday overnight window remains active on Tuesday morning', () => {
  const menu = [{
    name: 'Heizzeiten',
    uri: '/schedule',
    children: [
      { name: 'Montag', uri: '/monday', children: [{ name: 'Zeitfenster 1', uri: '/monday/1' }] },
      { name: 'Dienstag', uri: '/tuesday', children: [{ name: 'Zeitfenster 1', uri: '/tuesday/1' }] },
    ],
  }] as MenuNode[];
  const values: EtaData = {
    '/monday/1': { id: '/monday/1', parentId: null, value: '', strValue: '22:00 - 06:00' },
    '/tuesday/1': { id: '/tuesday/1', parentId: null, value: '', strValue: '00:00 - 00:00' },
  };
  assert.equal(checkHeatingTime(menu, values, new Date('2026-06-02T00:30:00Z')), true);
  assert.equal(checkHeatingTime(menu, values, new Date('2026-06-02T04:00:00Z')), false);
});

test('Tuesday overnight window does not start on Tuesday morning', () => {
  const menu = [{
    name: 'Heizzeiten',
    uri: '/schedule',
    children: [
      { name: 'Dienstag', uri: '/tuesday', children: [{ name: 'Zeitfenster 1', uri: '/tuesday/1' }] },
    ],
  }] as MenuNode[];
  const values: EtaData = {
    '/tuesday/1': { id: '/tuesday/1', parentId: null, value: '', strValue: '22:00 - 06:00' },
  };
  assert.equal(checkHeatingTime(menu, values, new Date('2026-06-02T00:30:00Z')), false);
  assert.equal(checkHeatingTime(menu, values, new Date('2026-06-02T20:30:00Z')), true);
});

test('overnight windows cross the week and the Vienna daylight-saving transition', () => {
  const menu = [{
    name: 'Heizzeiten', uri: '/schedule', children: [
      { name: 'Sonntag', uri: '/sunday', children: [{ name: 'Zeitfenster 1', uri: '/sunday/1' }] },
      { name: 'Samstag', uri: '/saturday', children: [{ name: 'Zeitfenster 1', uri: '/saturday/1' }] },
    ],
  }] as MenuNode[];
  const values: EtaData = {
    '/sunday/1': { id: '/sunday/1', parentId: null, value: '', strValue: '22:00 - 06:00' },
    '/saturday/1': { id: '/saturday/1', parentId: null, value: '', strValue: '22:00 - 06:00' },
  };
  assert.equal(checkHeatingTime(menu, values, new Date('2026-06-01T01:00:00Z')), true);
  assert.equal(checkHeatingTime(menu, values, new Date('2026-03-29T01:30:00Z')), true);
});

test('minimum temperature protection takes priority over a negative slider', () => {
  const result = determineControlAction({
    indoorTemp: 18,
    minTemp: 20,
    sliderPos: -5,
    currentActiveButton: EtaButtons.AA,
    lastTempState: { wasBelow: false, wasSliderNegative: false, manualOverride: false, manualOverrideTime: null, initialized: true },
    manualOverrideDurationMs: 60000,
    currentTime: 100000,
  });
  assert.equal(result.targetButton, EtaButtons.KT);
});

test('concurrent mode changes leave only one mode active', async () => {
  const ids = getHeatingButtonIds(defaultNames2Id);
  const active = new Set<string>([ids[EtaButtons.AA]]);
  const etaApi = {
    setUserVar: async (id: string, value: string) => {
      if (value === EtaPos.EIN) active.add(id);
      else active.delete(id);
      return { result: 'ok', error: null };
    },
  } as unknown as EtaApi;

  await Promise.all([
    setHeatingMode({ targetButton: EtaButtons.HT, names2id: defaultNames2Id, etaApi }),
    setHeatingMode({ targetButton: EtaButtons.KT, names2id: defaultNames2Id, etaApi }),
  ]);
  assert.equal(active.size, 1);
});

test('failed automatic mode switch is retried instead of becoming an override', async () => {
  const service = BackgroundService.getInstance() as unknown as {
    config: typeof defaultConfig;
    etaApi: EtaApi;
    wifiRefreshSucceeded: boolean;
    lastControlEtaUpdate: number | null;
    lastTempState: {
      wasBelow: boolean;
      wasSliderNegative: boolean;
      manualOverride: boolean;
      manualOverrideTime: number | null;
      initialized: boolean;
    };
    updateTemperatureDiff: (data: { time: number; datestring: string; temperature: number; indoorTemperature: number; allData: null }) => Promise<void>;
  };
  let attempts = 0;
  service.config = { ...defaultConfig, t_min: '18' };
  service.lastTempState = { wasBelow: false, wasSliderNegative: false, manualOverride: false, manualOverrideTime: null, initialized: false };
  service.etaApi = {
    disposed: false,
    setUserVar: async () => {
      attempts++;
      return { result: null, error: 'simulated failure' };
    },
  } as unknown as EtaApi;
  store.dispatch(storeConfigData(service.config));

  const ids = getHeatingButtonIds(defaultNames2Id);
  const etaData: EtaData = {};
  for (const [button, uri] of Object.entries(ids)) {
    etaData[uri] = {
      id: uri, parentId: null, short: button as EtaModeButton,
      value: button === EtaButtons.KT ? EtaPos.EIN : EtaPos.AUS,
      strValue: button === EtaButtons.KT ? 'Ein' : 'Aus',
    };
  }
  store.dispatch(storeEtaData(etaData));
  const wifi = { time: Date.now(), datestring: '', temperature: 5, indoorTemperature: 21, allData: null };
  store.dispatch(storeWifiData(wifi));
  service.wifiRefreshSucceeded = true;
  service.lastControlEtaUpdate = Date.now();
  await service.updateTemperatureDiff(wifi);
  await service.updateTemperatureDiff(wifi);
  assert.equal(service.lastTempState.manualOverride, false);
  assert.equal(attempts, 2);
});

test('partial repair of invalid modes is retried even if one wrong mode remains active', async () => {
  const service = BackgroundService.getInstance() as unknown as {
    config: typeof defaultConfig;
    etaApi: EtaApi;
    wifiRefreshSucceeded: boolean;
    lastControlEtaUpdate: number | null;
    pendingAutomaticSwitch: boolean;
    sleep: (ms: number) => Promise<void>;
    lastTempState: {
      wasBelow: boolean;
      wasSliderNegative: boolean;
      manualOverride: boolean;
      manualOverrideTime: number | null;
      initialized: boolean;
    };
    updateTemperatureDiff: (data: { time: number; datestring: string; temperature: number; indoorTemperature: number; allData: null }) => Promise<void>;
  };
  service.config = { ...defaultConfig, t_min: '18', t_slider: '0' };
  service.lastTempState = { wasBelow: false, wasSliderNegative: false, manualOverride: false, manualOverrideTime: null, initialized: true };
  service.pendingAutomaticSwitch = false;
  service.wifiRefreshSucceeded = true;
  service.lastControlEtaUpdate = Date.now();
  store.dispatch(storeConfigData(service.config));
  const wifi = { time: Date.now(), datestring: '', temperature: 5, indoorTemperature: 21, allData: null };
  store.dispatch(storeWifiData(wifi));
  const ids = getHeatingButtonIds(defaultNames2Id);
  const active = new Set<string>([ids[EtaButtons.HT], ids[EtaButtons.KT]]);
  let failKommen = true;
  service.etaApi = {
    disposed: false,
    setUserVar: async (id: string, value: string) => {
      if (failKommen && id === ids[EtaButtons.KT]) return { result: null, error: 'simulated failure' };
      if (value === EtaPos.EIN) active.add(id);
      else active.delete(id);
      return { result: 'ok', error: null };
    },
  } as unknown as EtaApi;
  const publishReadings = () => {
    const etaData: EtaData = {};
    for (const [button, uri] of Object.entries(ids)) {
      const isActive = active.has(uri);
      etaData[uri] = {
        id: uri, parentId: null, short: button, value: isActive ? EtaPos.EIN : EtaPos.AUS,
        strValue: isActive ? 'Ein' : 'Aus',
      };
    }
    store.dispatch(storeEtaData(etaData));
  };
  const originalSleep = service.sleep;
  service.sleep = async () => undefined;
  try {
    publishReadings();
    await service.updateTemperatureDiff(wifi);
    assert.deepEqual([...active], [ids[EtaButtons.KT]]);
    assert.equal(service.pendingAutomaticSwitch, true);
    failKommen = false;
    publishReadings();
    await service.updateTemperatureDiff(wifi);
    assert.deepEqual([...active], [ids[EtaButtons.AA]]);
    assert.equal(service.lastTempState.manualOverride, false);
    assert.equal(service.pendingAutomaticSwitch, false);
  } finally {
    service.sleep = originalSleep;
  }
});

test('restarting the polling interval during an update leaves one polling loop', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const service = BackgroundService.getInstance() as unknown as {
    config: typeof defaultConfig;
    isRunning: boolean;
    loadAndStoreData: () => Promise<void>;
    restartUpdateInterval: () => void;
  };
  const originalLoad = service.loadAndStoreData;
  let resolveFirst: (() => void) | undefined;
  let calls = 0;
  service.isRunning = true;
  service.config = { ...defaultConfig, t_update_timer: '5000' };
  service.loadAndStoreData = async () => {
    calls++;
    if (calls === 1) await new Promise<void>(resolve => { resolveFirst = resolve; });
  };
  try {
    service.restartUpdateInterval();
    t.mock.timers.tick(5000);
    assert.equal(calls, 1);
    service.config = { ...service.config, t_update_timer: '10000' };
    service.restartUpdateInterval();
    resolveFirst?.();
    await Promise.resolve();
    await Promise.resolve();
    t.mock.timers.tick(5000);
    assert.equal(calls, 1);
    t.mock.timers.tick(5000);
    assert.equal(calls, 2);
    await Promise.resolve();
    await Promise.resolve();
    t.mock.timers.tick(5000);
    assert.equal(calls, 2);
  } finally {
    service.isRunning = false;
    service.loadAndStoreData = originalLoad;
  }
});
