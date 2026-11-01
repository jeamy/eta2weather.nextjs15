import assert from 'node:assert/strict';
import { setHeatingCircuit } from './heatingCircuit';
import { EtaPos } from '@/reader/functions/types-constants/EtaConstants';
import { defaultNames2Id, EtaConstants } from '@/reader/functions/types-constants/Names2IDconstants';

const id = defaultNames2Id[EtaConstants.EIN_AUS_TASTE].id;
const xml = (position: string, uri = id) =>
  `<eta><value uri="/user/var${uri}" strValue="${position === EtaPos.EIN ? 'Ein' : 'Aus'}">${position}</value></eta>`;

async function runTests() {
  let position: EtaPos = EtaPos.EIN;
  const writes: string[] = [];
  const reads: string[] = [];
  const api = {
    getUserVar: async () => ({ result: xml(position), error: null }),
    setUserVar: async (_id: string, value: string, begin: string, end: string) => {
      assert.equal(_id, id);
      assert.equal(begin, '0');
      assert.equal(end, '0');
      writes.push(value);
      position = value as EtaPos;
      return { result: 'ok', error: null };
    },
  };
  const options = {
    etaApi: api,
    names2id: defaultNames2Id,
    onRead: (_id: string, data: { value: string }) => reads.push(data.value),
  };

  let result = await setHeatingCircuit({ ...options, expected: EtaPos.EIN, target: EtaPos.AUS });
  assert.equal(result.status, 'applied');
  assert.deepEqual(writes, [EtaPos.AUS]);
  assert.deepEqual(reads, [EtaPos.EIN, EtaPos.AUS]);

  result = await setHeatingCircuit({ ...options, expected: EtaPos.EIN, target: EtaPos.AUS });
  assert.equal(result.status, 'changed');
  assert.deepEqual(writes, [EtaPos.AUS]);

  result = await setHeatingCircuit({ ...options, expected: EtaPos.AUS, target: EtaPos.EIN });
  assert.equal(result.status, 'applied');
  assert.deepEqual(writes, [EtaPos.AUS, EtaPos.EIN]);

  const duplicateRequests = await Promise.all([
    setHeatingCircuit({ ...options, expected: EtaPos.EIN, target: EtaPos.AUS }),
    setHeatingCircuit({ ...options, expected: EtaPos.EIN, target: EtaPos.AUS }),
  ]);
  assert.deepEqual(duplicateRequests.map(item => item.status), ['applied', 'changed']);
  assert.deepEqual(writes, [EtaPos.AUS, EtaPos.EIN, EtaPos.AUS]);

  const unreadableApi = { ...api, getUserVar: async () => ({ result: null, error: 'offline' }) };
  await assert.rejects(
    setHeatingCircuit({ ...options, etaApi: unreadableApi, expected: EtaPos.AUS, target: EtaPos.EIN }),
    /nicht gelesen/,
  );
  assert.equal(writes.length, 3);

  const invalidApi = { ...api, getUserVar: async () => ({ result: xml(EtaPos.AUS, '/1/2/3/4/5'), error: null }) };
  await assert.rejects(
    setHeatingCircuit({ ...options, etaApi: invalidApi, expected: EtaPos.AUS, target: EtaPos.EIN }),
    /ungültigen Heizkreis-Status/,
  );
  assert.equal(writes.length, 3);

  const failedWriteApi = { ...api, setUserVar: async () => ({ result: null, error: 'timeout' }) };
  result = await setHeatingCircuit({ ...options, etaApi: failedWriteApi, expected: EtaPos.AUS, target: EtaPos.EIN });
  assert.equal(result.status, 'uncertain');

  const unchangedApi = { ...api, setUserVar: async () => ({ result: 'ok', error: null }) };
  result = await setHeatingCircuit({ ...options, etaApi: unchangedApi, expected: EtaPos.AUS, target: EtaPos.EIN });
  assert.equal(result.status, 'uncertain');
  assert.equal(result.data?.value, EtaPos.AUS);

  let readCount = 0;
  const failedReadbackApi = {
    ...api,
    getUserVar: async () => ++readCount === 1
      ? { result: xml(EtaPos.AUS), error: null }
      : { result: null, error: 'offline' },
  };
  result = await setHeatingCircuit({ ...options, etaApi: failedReadbackApi, expected: EtaPos.AUS, target: EtaPos.EIN });
  assert.equal(result.status, 'uncertain');

  console.log('PASS: heating circuit checks current state, serializes writes and verifies readback without real devices');
}

runTests().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
