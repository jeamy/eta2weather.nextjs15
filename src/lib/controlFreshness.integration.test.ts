import assert from 'node:assert/strict';
import { BackgroundService } from './backgroundService';
import { DatabaseService } from './database/sqliteService';
import { WifiAf83Api } from '@/reader/functions/WifiAf83Api';
import { defaultNames2Id, EtaConstants } from '@/reader/functions/types-constants/Names2IDconstants';
import { defaultConfig } from '@/reader/functions/types-constants/ConfigConstants';
import { EtaPos } from '@/reader/functions/types-constants/EtaConstants';
import { store } from '@/redux/store';
import { storeData as storeWifiData } from '@/redux/wifiAf83Slice';
import { storeData as storeEtaData } from '@/redux/etaSlice';
import { WIFIAF83_CACHE_KEY, wifiaf83Cache } from '@/utils/cache';
import { GET as getBackgroundStatus } from '@/app/api/background/status/route';

async function main() {
  const service = BackgroundService.getInstance() as any;
  const db = DatabaseService.getInstance();
  const originalInsert = db.insertEcowittLog;
  const originalFetch = WifiAf83Api.prototype.getAllRealtime;
  const shared = globalThis as typeof globalThis & { __ETA2WEATHER_WIFI_REFRESH__?: Promise<any> | null };
  const now = Date.now();
  const allData = {
    indoor: { temperature: { value: '20', time: String(Math.floor(now / 1000)) } },
    outdoor: { temperature: { value: '6', time: String(Math.floor(now / 1000)) } },
  };
  let failedId: string | null = null;
  let writes = 0;
  let changeCircuitDuringScan = false;
  let unavailableFlow = false;
  let changeEndpointDuringScan = false;
  const actions: string[] = [];
  const shortById = Object.fromEntries(Object.entries(defaultNames2Id).map(([key, item]) => [item.id.slice(1), key]));

  service.config = { ...defaultConfig };
  service.names2Id = defaultNames2Id;
  service.menuLoadedOnce = true;
  service.cachedMenuNodes = [];
  service.cachedUris = Object.values(defaultNames2Id).map(item => item.id);
  service.lastFullEtaScan = Date.now();
  service.cleanupOldData = async () => undefined;
  service.updateAutomaticDelta = async () => { actions.push('delta'); };
  service.updateIndoorTemperatureDiff = async () => { actions.push('diff'); };
  service.updateTemperatureDiff = async () => { actions.push('mode'); };
  service.etaApi = {
    disposed: false,
    getUserVar: async (id: string) => {
      if (id === failedId) return { result: null, error: 'offline' };
      const key = shortById[id];
      if (changeEndpointDuringScan) {
        changeEndpointDuringScan = false;
        service.config = { ...service.config, s_eta: 'http://different.invalid' };
      }
      if (key === EtaConstants.EIN_AUS_TASTE && changeCircuitDuringScan) {
        changeCircuitDuringScan = false;
        const circuitId = defaultNames2Id[EtaConstants.EIN_AUS_TASTE].id;
        const etaData = store.getState().eta.data;
        store.dispatch(storeEtaData({
          ...etaData,
          [circuitId]: { ...etaData[circuitId], value: EtaPos.EIN, strValue: 'Ein' },
        }));
      }
      const strValue = key === EtaConstants.SCHIEBERPOS ? '0 %'
        : key === EtaConstants.VORLAUFTEMP ? (unavailableFlow ? '---' : '40 °C')
          : key === EtaConstants.AUSSENTEMP ? '6 °C' : 'Aus';
      return { result: `<eta><value uri="/${id}" strValue="${strValue}">${EtaPos.AUS}</value></eta>`, error: null };
    },
    setUserVar: async () => { writes++; throw new Error('Unexpected physical write'); },
  };
  db.insertEcowittLog = async () => undefined;
  WifiAf83Api.prototype.getAllRealtime = async () => { throw new Error('offline'); };
  try {
    wifiaf83Cache.set(WIFIAF83_CACHE_KEY, allData);
    const previous = { time: now - 120000, datestring: '', temperature: 4, indoorTemperature: 19, allData: null };
    store.dispatch(storeWifiData(previous));
    service.wifiRefreshSucceeded = true;
    await service.loadAndStoreData();
    assert.equal(store.getState().wifiAf83.data.time, previous.time);
    assert.equal(service.getDataFreshness().wifiFresh, false);
    assert.deepEqual(actions, []);
    assert.equal(writes, 0);
    const staleStatus = await (await getBackgroundStatus()).json();
    assert.equal(staleStatus.data.wifiAf83.time, previous.time);
    assert.equal(staleStatus.data.wifiAf83.stale, true);
    assert.equal(staleStatus.data.diagnostics.wifiFresh, false);
    assert.equal(staleStatus.data.diagnostics.etaDataFresh, true);

    shared.__ETA2WEATHER_WIFI_REFRESH__ = Promise.resolve(allData);
    failedId = defaultNames2Id[EtaConstants.SCHIEBERPOS].id.slice(1);
    await service.loadAndStoreData();
    assert.equal(service.getDataFreshness().etaFresh, false);
    const partialStatus = await (await getBackgroundStatus()).json();
    assert.equal(partialStatus.data.diagnostics.etaFresh, false);
    assert.equal(partialStatus.data.diagnostics.etaDataFresh, false);
    assert.equal(partialStatus.data.eta[defaultNames2Id[EtaConstants.SCHIEBERPOS].id], undefined);
    assert.deepEqual(actions, ['delta']);
    assert.equal(writes, 0);

    actions.length = 0;
    failedId = defaultNames2Id[EtaConstants.VORLAUFTEMP].id.slice(1);
    shared.__ETA2WEATHER_WIFI_REFRESH__ = Promise.resolve(allData);
    await service.loadAndStoreData();
    const failedFlowStatus = await (await getBackgroundStatus()).json();
    assert.equal(failedFlowStatus.data.diagnostics.etaDataFresh, false);
    assert.equal(failedFlowStatus.data.diagnostics.etaFresh, true);
    assert.equal(failedFlowStatus.data.eta[defaultNames2Id[EtaConstants.VORLAUFTEMP].id], undefined);
    assert.deepEqual(actions, ['delta', 'diff', 'mode']);
    assert.equal(writes, 0);

    actions.length = 0;
    failedId = null;
    unavailableFlow = true;
    shared.__ETA2WEATHER_WIFI_REFRESH__ = Promise.resolve(allData);
    await service.loadAndStoreData();
    const unavailableStatus = await (await getBackgroundStatus()).json();
    assert.equal(unavailableStatus.data.diagnostics.etaDataFresh, true);
    assert.equal(unavailableStatus.data.diagnostics.etaFresh, true);
    assert.equal(unavailableStatus.data.eta[defaultNames2Id[EtaConstants.VORLAUFTEMP].id].strValue, '---');
    assert.deepEqual(actions, ['delta', 'diff', 'mode']);
    assert.equal(writes, 0);

    actions.length = 0;
    unavailableFlow = false;
    shared.__ETA2WEATHER_WIFI_REFRESH__ = Promise.resolve(allData);
    await service.loadAndStoreData();
    assert.equal(service.getDataFreshness().etaFresh, true);
    assert.equal(service.getDataFreshness().wifiFresh, true);
    const recoveredStatus = await (await getBackgroundStatus()).json();
    assert.equal(recoveredStatus.data.wifiAf83.stale, false);
    assert.equal(recoveredStatus.data.diagnostics.etaFresh, true);
    assert.equal(recoveredStatus.data.diagnostics.etaDataFresh, true);
    assert.deepEqual(actions, ['delta', 'diff', 'mode']);
    assert.equal(writes, 0);

    actions.length = 0;
    const allUris = service.cachedUris;
    service.cachedUris = allUris.filter((uri: string) => uri !== defaultNames2Id[EtaConstants.VORLAUFTEMP].id);
    shared.__ETA2WEATHER_WIFI_REFRESH__ = Promise.resolve(allData);
    await service.loadAndStoreData();
    assert.equal(store.getState().eta.data[defaultNames2Id[EtaConstants.VORLAUFTEMP].id], undefined);
    assert.equal(service.getDataFreshness().etaFresh, true);
    assert.deepEqual(actions, ['delta', 'diff', 'mode']);
    service.cachedUris = allUris;

    const lastCompletePoll = service.lastCompleteEtaPoll;
    service.lastCompleteEtaPoll = Date.now() - 1200000;
    assert.equal(service.getDataFreshness().etaDataFresh, false);
    service.lastCompleteEtaPoll = lastCompletePoll;

    actions.length = 0;
    changeCircuitDuringScan = true;
    shared.__ETA2WEATHER_WIFI_REFRESH__ = Promise.resolve(allData);
    await service.loadAndStoreData();
    assert.equal(store.getState().eta.data[defaultNames2Id[EtaConstants.EIN_AUS_TASTE].id].value, EtaPos.EIN);
    assert.equal(service.getDataFreshness().etaFresh, false);
    assert.equal(service.getDataFreshness().etaDataFresh, true);
    assert.deepEqual(actions, ['delta']);
    assert.equal(writes, 0);

    actions.length = 0;
    changeEndpointDuringScan = true;
    shared.__ETA2WEATHER_WIFI_REFRESH__ = Promise.resolve(allData);
    await service.loadAndStoreData();
    assert.equal(service.getDataFreshness().etaDataFresh, false);
    assert.equal(service.getDataFreshness().etaFresh, false);
    assert.equal(service.lastFullEtaScan, null);
    assert.deepEqual(actions, []);
    assert.equal(writes, 0);
    console.log('PASS: stale WiFi and missing required ETA data pause control; flow temperature is optional');
    console.log('PASS: manual circuit status is not overwritten by an older in-flight ETA scan');
    console.log('PASS: ETA poll freshness is separate from control readiness and invalidated on source changes');
  } finally {
    shared.__ETA2WEATHER_WIFI_REFRESH__ = null;
    db.insertEcowittLog = originalInsert;
    WifiAf83Api.prototype.getAllRealtime = originalFetch;
  }
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
