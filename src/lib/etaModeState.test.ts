import { getEtaModeState, normalizeEtaButtonState } from './etaModeState';
import { EtaButtons, EtaData, EtaPos } from '@/reader/functions/types-constants/EtaConstants';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`PASS: ${message}`);
}

const allOff: EtaData = {
  aa: { id: 'aa', parentId: null, value: EtaPos.AUS, strValue: 'Aus', short: EtaButtons.AA },
  kt: { id: 'kt', parentId: null, value: EtaPos.AUS, strValue: 'Aus', short: EtaButtons.KT },
};

const allOffState = getEtaModeState(allOff);
assert(allOffState.activeButton === null, 'all-off ETA data has no active mode');
assert(!allOffState.isValid, 'all-off ETA data is marked invalid');
assert(
  normalizeEtaButtonState(allOff).aa.value === EtaPos.AUS,
  'API normalization does not invent an active AA mode',
);

const multipleActive: EtaData = {
  aa: { ...allOff.aa, value: EtaPos.EIN, strValue: 'Ein' },
  kt: { ...allOff.kt, value: EtaPos.EIN, strValue: 'Ein' },
};
const multipleState = getEtaModeState(multipleActive);
assert(!multipleState.isValid, 'multiple active ETA modes are marked invalid');
assert(multipleState.activeButton === EtaButtons.KT, 'manual mode has display priority over AA');
