import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { defaultConfig } from '@/reader/functions/types-constants/ConfigConstants';
import { defaultNames2Id, EtaConstants } from '@/reader/functions/types-constants/Names2IDconstants';
import { EtaData } from '@/reader/functions/types-constants/EtaConstants';

async function main() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'eta-flow-control-test-'));
  process.env.CONFIG_PATH = path.join(directory, 'config.json');
  const config = { ...defaultConfig, t_soll: '22', t_delta: '-2.6', delta_override: 'true' };
  await writeFile(process.env.CONFIG_PATH, JSON.stringify(config));
  try {
    const { BackgroundService } = await import('./backgroundService');
    const { DatabaseService } = await import('./database/sqliteService');
    const { store } = await import('@/redux/store');
    const { storeData: storeConfig } = await import('@/redux/configSlice');
    const { storeData: storeEta } = await import('@/redux/etaSlice');
    const { storeData: storeWifi } = await import('@/redux/wifiAf83Slice');
    const service = BackgroundService.getInstance() as any;
    const db = DatabaseService.getInstance();
    db.insertTempDiffLog = async () => undefined;

    const writes: Array<[string, string]> = [];
    service.config = config;
    service.names2Id = defaultNames2Id;
    service.cachedMenuNodes = [];
    service.etaApi = {
      setUserVar: async (id: string, value: string) => {
        writes.push([id, value]);
        return { result: '<ok/>', error: null };
      },
    };
    const sliderId = defaultNames2Id[EtaConstants.SCHIEBERPOS].id;
    const flowId = defaultNames2Id[EtaConstants.VORLAUFTEMP].id;
    const data: EtaData = {};
    for (const [short, entry] of Object.entries(defaultNames2Id)) {
      data[entry.id] = { id: entry.id, parentId: null, short, value: '1802', strValue: 'Aus' };
    }
    data[defaultNames2Id[EtaConstants.EIN_AUS_TASTE].id].strValue = 'Ein';
    data[defaultNames2Id[EtaConstants.SCHALTZUSTAND].id].strValue = 'Ein';
    data[sliderId].strValue = '-29';
    data[flowId].strValue = '---';
    data[flowId]._readAt = String(Date.now());
    store.dispatch(storeConfig(config));
    store.dispatch(storeEta(data));

    const run = async (indoorTemperature: number) => {
      const wifi = { time: Date.now(), datestring: '', temperature: 10.2, indoorTemperature, allData: null };
      store.dispatch(storeWifi(wifi));
      service.wifiRefreshSucceeded = true;
      service.lastControlEtaUpdate = Date.now();
      await service.updateIndoorTemperatureDiff(wifi);
    };

    await run(21.7);
    assert.equal(store.getState().config.data.t_slider, '-11.0');
    assert.deepEqual(writes.pop(), [sliderId, '-110']);

    await run(20.48);
    assert.equal(store.getState().config.data.t_slider, '13.0');
    assert.deepEqual(writes.pop(), [sliderId, '130']);

    const eta = store.getState().eta.data;
    store.dispatch(storeEta({ ...eta, [flowId]: { ...eta[flowId], strValue: '44 °C', _readAt: String(Date.now()) } }));
    await run(20.48);
    assert.equal(store.getState().config.data.t_slider, '9.5');
    assert.deepEqual(writes.pop(), [sliderId, '100']);

    const etaWithFlow = store.getState().eta.data;
    store.dispatch(storeEta({ ...etaWithFlow, [flowId]: { ...etaWithFlow[flowId], strValue: '60 °C', _readAt: String(Date.now() - 3600000) } }));
    await run(20.48);
    assert.equal(store.getState().config.data.t_slider, '13.0');
    assert.deepEqual(writes.pop(), [sliderId, '130']);
    assert.deepEqual(writes, []);
    console.log('PASS: simulated slider writes use fresh flow damping and continue without unavailable or stale flow');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
