import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import ConfigData from '@/components/ConfigData';
import WifiAf83Data from '@/components/WifiAf83Data';
import HomeHero from '@/components/HomeHero';
import Header from '@/components/Header';
import { EtaDataProvider } from '@/components/EtaDataProvider';
import ToastProvider from '@/components/ToastProvider';
import { makeStore } from '@/redux';
import { storeData as storeConfig } from '@/redux/configSlice';
import { storeData as storeWifi } from '@/redux/wifiAf83Slice';
import { storeData as storeEta, setStale as setEtaStale } from '@/redux/etaSlice';
import { defaultConfig } from '@/reader/functions/types-constants/ConfigConstants';

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
