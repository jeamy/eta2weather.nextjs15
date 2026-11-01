import assert from 'node:assert/strict';
import { getFreshFlowTemperature, getFreshWifiMeasurementTime, hasFreshControlEtaData } from './controlFreshness';
import { EtaData, EtaPos } from '@/reader/functions/types-constants/EtaConstants';
import { defaultNames2Id, EtaConstants } from '@/reader/functions/types-constants/Names2IDconstants';
import { MenuNode } from '@/types/menu';
import { calculateNewSliderPosition } from '@/utils/Functions';

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
} }, defaultNames2Id, menu), true);
const missingFlow = { ...data };
delete missingFlow[defaultNames2Id[EtaConstants.VORLAUFTEMP].id];
assert.equal(hasFreshControlEtaData(missingFlow, defaultNames2Id, menu), true);
const missingSlider = { ...data };
delete missingSlider[defaultNames2Id[EtaConstants.SCHIEBERPOS].id];
assert.equal(hasFreshControlEtaData(missingSlider, defaultNames2Id, menu), false);
for (const key of [EtaConstants.EIN_AUS_TASTE, EtaConstants.SCHALTZUSTAND]) {
  const id = defaultNames2Id[key].id;
  assert.equal(hasFreshControlEtaData({ ...data, [id]: { ...data[id], strValue: '---' } }, defaultNames2Id, menu), false);
}

const flowId = defaultNames2Id[EtaConstants.VORLAUFTEMP].id;
const withFlow = {
  ...data,
  [flowId]: { ...data[flowId], strValue: '44,0 °C', _readAt: '1000000' },
};
assert.equal(getFreshFlowTemperature(withFlow, flowId, 1001000, 600000), 44);
assert.equal(getFreshFlowTemperature(withFlow, flowId, 1600001, 600000), null);
assert.equal(getFreshFlowTemperature(withFlow, flowId, 999999, 600000), null);
assert.equal(getFreshFlowTemperature(missingFlow, flowId, 1001000, 600000), null);
assert.equal(getFreshFlowTemperature({ ...withFlow, [flowId]: { ...withFlow[flowId], strValue: '---' } }, flowId, 1001000, 600000), null);

const activeHeating = { einaus: 'Ein', schaltzustand: 'Ein', heizentaste: 'Aus', kommentaste: 'Aus' };
assert.deepEqual(calculateNewSliderPosition({ ...activeHeating, vorlauftemp: null }, 1), { base: '13.0', final: '13.0' });
assert.deepEqual(calculateNewSliderPosition({ ...activeHeating, vorlauftemp: 44 }, 1), { base: '13.0', final: '9.5' });
assert.deepEqual(calculateNewSliderPosition({ ...activeHeating, vorlauftemp: 60 }, 1), { base: '13.0', final: '0.0' });
assert.deepEqual(calculateNewSliderPosition({ ...activeHeating, vorlauftemp: 60 }, -0.22), { base: '-11.0', final: '-11.0' });
assert.equal(getFreshWifiMeasurementTime('1000', '1001', 1002000, 600000), 1000000);
assert.equal(getFreshWifiMeasurementTime('1', '1001', 1002000, 600000), null);
assert.equal(getFreshWifiMeasurementTime(undefined, '1001', 1002000, 600000), null);
assert.equal(getFreshWifiMeasurementTime('9999', '1001', 1002000, 600000), null);
console.log('PASS: automatic control requires fresh, valid inputs; flow damping is optional and uses only fresh values');
