import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import ConfigData from '@/components/ConfigData';
import WifiAf83Data from '@/components/WifiAf83Data';
import HomeHero from '@/components/HomeHero';
import Header from '@/components/Header';
import HeatingCircuitDialog from '@/components/HeatingCircuitDialog';
import { MenuPopupValue } from '@/components/MenuPopup';
import EtaControlStatus from '@/components/EtaControlStatus';
import { EtaDataProvider } from '@/components/EtaDataProvider';
import ToastProvider from '@/components/ToastProvider';
import { makeStore } from '@/redux';
import { storeData as storeConfig } from '@/redux/configSlice';
import { storeData as storeWifi } from '@/redux/wifiAf83Slice';
import { storeData as storeEta, setStale as setEtaStale, setControlDataReady } from '@/redux/etaSlice';
import { defaultConfig } from '@/reader/functions/types-constants/ConfigConstants';
import { EtaButtons, EtaPos } from '@/reader/functions/types-constants/EtaConstants';
import { EtaConstants } from '@/reader/functions/types-constants/Names2IDconstants';

const store = makeStore();
store.dispatch(storeConfig({ ...defaultConfig, t_delta: '1.5', delta_override: 'true' }));
store.dispatch(storeWifi({
  time: 1, datestring: '', temperature: 6.7, indoorTemperature: 21.3, allData: null, stale: true,
}));
const html = renderToStaticMarkup(
  <Provider store={store}>
    <ToastProvider>
      <ConfigData />
      <WifiAf83Data />
    </ToastProvider>
  </Provider>,
);
assert.match(html, /Roh: 1\.5°C ÷ 5/);
assert.match(html, /0\.30°C/);
assert.match(html, /Sensordaten veraltet/);
console.log('PASS: manual delta displays the dampened value and stale WiFi data is marked');

const initialHtml = renderToStaticMarkup(<Provider store={makeStore()}><HomeHero /></Provider>);
assert.match(initialHtml, /Warte auf Daten/);
assert.doesNotMatch(initialHtml, /0\.0 °C/);

store.dispatch(storeEta({ test: { id: 'test', parentId: null, value: '1', strValue: '1' } }));
store.dispatch(setEtaStale(false));
const headerHtml = renderToStaticMarkup(
  <Provider store={store}><EtaDataProvider><Header /></EtaDataProvider></Provider>,
);
assert.match(headerHtml, /Daten veraltet/);
assert.doesNotMatch(headerHtml, /ETA &amp; WiFi aktuell/);
console.log('PASS: empty readings are not displayed as zeros and the header marks stale sources');

const heroStore = makeStore();
heroStore.dispatch(storeConfig({ ...defaultConfig, t_slider: '0.0' }));
heroStore.dispatch(storeEta({
  slider: { id: 'slider', parentId: null, short: EtaConstants.SCHIEBERPOS, value: '-290', strValue: '-29' },
  auto: { id: 'auto', parentId: null, short: EtaButtons.AA, value: EtaPos.EIN, strValue: 'Ein' },
  gehen: { id: 'gehen', parentId: null, short: EtaButtons.GT, value: EtaPos.EIN, strValue: 'Ein' },
}));
heroStore.dispatch(setEtaStale(false));
heroStore.dispatch(setControlDataReady(true));
const renderHero = () => renderToStaticMarkup(<Provider store={heroStore}><HomeHero /></Provider>);
let heroHtml = renderHero();
assert.match(heroHtml, /title="Von der ETA gemeldete Schieberposition"[\s\S]*?-29 %[\s\S]*?Gehen aktiv/);
assert.match(heroHtml, /title="Betriebsmodus"[\s\S]*?homeKpi__value is-warning">Gehen</);
assert.match(heroHtml, /aria-valuetext="-29 %"/);
assert.doesNotMatch(heroHtml, /Regelung pausiert|ETA-Abruf veraltet/);

heroStore.dispatch(setEtaStale(true));
heroHtml = renderHero();
assert.match(heroHtml, /-29 %[\s\S]*?Gehen aktiv · ETA-Abruf veraltet\/unvollständig/);

heroStore.dispatch(setEtaStale(false));
heroStore.dispatch(setControlDataReady(false));
heroHtml = renderHero();
assert.match(heroHtml, /-29 %[\s\S]*?Gehen aktiv · Regelung pausiert/);
assert.doesNotMatch(heroHtml, /ETA-Abruf veraltet/);

heroStore.dispatch(storeEta({
  slider: { id: 'slider', parentId: null, short: EtaConstants.SCHIEBERPOS, value: '-290', strValue: '-29' },
  auto: { id: 'auto', parentId: null, short: EtaButtons.AA, value: EtaPos.EIN, strValue: 'Ein' },
}));
heroStore.dispatch(setEtaStale(false));
heroStore.dispatch(setControlDataReady(true));
heroHtml = renderHero();
assert.match(heroHtml, /-29 %[\s\S]*?Auto aktiv/);
assert.doesNotMatch(heroHtml, /Gehen aktiv/);

heroStore.dispatch(storeEta({
  slider: { id: 'slider', parentId: null, short: EtaConstants.SCHIEBERPOS, value: '0', strValue: '---' },
  auto: { id: 'auto', parentId: null, short: EtaButtons.AA, value: EtaPos.EIN, strValue: 'Ein' },
}));
heroHtml = renderHero();
assert.match(heroHtml, /title="Von der ETA gemeldete Schieberposition"[\s\S]*?homeKpi__value">–<\/div>[\s\S]*?Auto aktiv/);
assert.doesNotMatch(heroHtml, /aria-label="ETA-Schieberposition"/);

heroStore.dispatch(storeEta({
  slider: { id: 'slider', parentId: null, short: EtaConstants.SCHIEBERPOS, value: '125', strValue: '12,5' },
}));
heroHtml = renderHero();
assert.match(heroHtml, /\+12,5 %[\s\S]*?Modus unbekannt/);
console.log('PASS: dashboard shows ETA slider and mode, including stale and missing values');

const dialog = (target: EtaPos, stale: boolean, busy = false) => renderToStaticMarkup(
  <HeatingCircuitDialog target={target} stale={stale} busy={busy} onCancel={() => undefined} onConfirm={() => undefined} />,
);
const offDialog = dialog(EtaPos.AUS, true);
assert.match(offDialog, /Heizkreis ausschalten\?/);
assert.match(offDialog, /Mindesttemperaturregelung/);
assert.match(offDialog, /nicht vollständig aktuell/);
assert.match(offDialog, />Nein<\/button>/);
assert.match(offDialog, />Ja<\/button>/);
assert.match(dialog(EtaPos.EIN, false), /Heizkreis einschalten\?/);
assert.doesNotMatch(dialog(EtaPos.EIN, false), /nicht vollständig aktuell/);
assert.match(dialog(EtaPos.EIN, false, true), /disabled=""/);
console.log('PASS: heating circuit confirmation clearly distinguishes on, off and stale data');

for (const [value, unit, expected] of [
  ['51', '°C', '51 °C'],
  ['51 °C', '°C', '51 °C'],
  ['1,49', 'bar', '1,49 bar'],
  ['1,49 bar', 'bar', '1,49 bar'],
  ['1,620', 'V', '1,620 V'],
  ['-1,4', 'Pa', '-1,4 Pa'],
  ['174h 8m', 's', '174h 8m'],
  ['Ein', '', 'Ein'],
]) {
  const markup = renderToStaticMarkup(
    <MenuPopupValue data={{ id: 'test', parentId: null, value: '0', strValue: value, unit }} />,
  );
  assert.equal(markup.replace(/<span class="text-muted ml-1">/g, ' ').replace(/<[^>]*>/g, ''), expected);
}
console.log('PASS: ETA menu values display each unit only once');

const etaStatusData = {
  flow: { id: 'flow', parentId: null, short: EtaConstants.VORLAUFTEMP, value: '0', strValue: '---' },
};
const etaStatus = (isStale: boolean, controlDataReady: boolean) => renderToStaticMarkup(
  <EtaControlStatus data={etaStatusData} isStale={isStale} controlDataReady={controlDataReady} />,
);
assert.match(etaStatus(false, false), /Regelung pausiert.*ETA-Regelungsdaten nicht verfügbar oder ungültig.*Vorlauftemperatur nicht verfügbar.*Dämpfung inaktiv/);
assert.doesNotMatch(etaStatus(false, false), /veraltet/);
assert.match(etaStatus(true, false), /ETA-Abfrage veraltet oder unvollständig/);
assert.match(etaStatus(false, true), /Vorlauftemperatur nicht verfügbar.*Dämpfung inaktiv/);
assert.doesNotMatch(etaStatus(false, true), /Regelung pausiert/);
assert.equal(renderToStaticMarkup(
  <EtaControlStatus data={{ flow: { ...etaStatusData.flow, strValue: '44 °C' } }} isStale={false} controlDataReady />,
), '');
console.log('PASS: dashboard distinguishes current ETA responses from unavailable control data');
