import assert from 'node:assert/strict';
import { getFreshWifiMeasurementTime, hasFreshControlEtaData } from './controlFreshness';
import { EtaData, EtaPos } from '@/reader/functions/types-constants/EtaConstants';
import { defaultNames2Id, EtaConstants } from '@/reader/functions/types-constants/Names2IDconstants';
import { MenuNode } from '@/types/menu';

const data: EtaData = {};
for (const [key, entry] of Object.entries(defaultNames2Id)) {
  data[entry.id] = { id: entry.id, parentId: null, short: key, value: EtaPos.AUS, strValue: 'Aus' };
}
data[defaultNames2Id[EtaConstants.SCHIEBERPOS].id].strValue = '0 %';
data[defaultNames2Id[EtaConstants.VORLAUFTEMP].id].strValue = '40,0 °C';
const menu: MenuNode[] = [{
  name: 'Heizzeiten', uri: '/schedule',
  children: [{ name: 'Zeitfenster 1', uri: '/window' }],
}];
data['/window'] = { id: '/window', parentId: null, value: '0', strValue: '06:00 - 08:00' };

assert.equal(hasFreshControlEtaData(data, defaultNames2Id, menu), true);
const missingButton = { ...data };
delete missingButton[defaultNames2Id[EtaConstants.HEIZENTASTE].id];
assert.equal(hasFreshControlEtaData(missingButton, defaultNames2Id, menu), false);
const missingWindow = { ...data };
delete missingWindow['/window'];
assert.equal(hasFreshControlEtaData(missingWindow, defaultNames2Id, menu), false);
assert.equal(hasFreshControlEtaData({ ...data, '/window': { ...data['/window'], strValue: 'N/A' } }, defaultNames2Id, menu), false);
assert.equal(hasFreshControlEtaData({ ...data, '/window': { ...data['/window'], strValue: '25:00 - 08:00' } }, defaultNames2Id, menu), false);
assert.equal(hasFreshControlEtaData({ ...data, [defaultNames2Id[EtaConstants.VORLAUFTEMP].id]: {
  ...data[defaultNames2Id[EtaConstants.VORLAUFTEMP].id], strValue: 'N/A',
} }, defaultNames2Id, menu), false);
assert.equal(getFreshWifiMeasurementTime('1000', '1001', 1002000, 600000), 1000000);
assert.equal(getFreshWifiMeasurementTime('1', '1001', 1002000, 600000), null);
assert.equal(getFreshWifiMeasurementTime(undefined, '1001', 1002000, 600000), null);
assert.equal(getFreshWifiMeasurementTime('9999', '1001', 1002000, 600000), null);
console.log('PASS: automatic control requires fresh, valid ETA inputs and schedule windows');
