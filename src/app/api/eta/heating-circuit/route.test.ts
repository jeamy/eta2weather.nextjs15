import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { API } from '@/constants/apiPaths';
import { EtaApi } from '@/reader/functions/EtaApi';
import { EtaPos } from '@/reader/functions/types-constants/EtaConstants';
import { defaultConfig } from '@/reader/functions/types-constants/ConfigConstants';
import { defaultNames2Id, EtaConstants } from '@/reader/functions/types-constants/Names2IDconstants';
import { configCache, CONFIG_CACHE_KEY, names2idCache, NAMES2ID_CACHE_KEY } from '@/utils/cache';
import { getServerStore } from '@/lib/backgroundService';

async function runTests() {
  configCache.set(CONFIG_CACHE_KEY, { ...defaultConfig, s_eta: 'http://example.invalid' });
  names2idCache.set(`${NAMES2ID_CACHE_KEY}:${defaultConfig.f_names2id || 'f_names2id.json'}`, defaultNames2Id);

  const id = defaultNames2Id[EtaConstants.EIN_AUS_TASTE].id;
  const request = (body: unknown, origin = 'http://localhost') => new NextRequest(`http://localhost${API.ETA_HEATING_CIRCUIT}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  });

  let position: EtaPos = EtaPos.EIN;
  let reads = 0;
  let writes = 0;
  const originalRead = EtaApi.prototype.getUserVar;
  const originalWrite = EtaApi.prototype.setUserVar;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Unexpected network access in test'); };
  EtaApi.prototype.getUserVar = async () => {
    reads++;
    return {
      result: `<eta><value uri="/user/var${id}" strValue="${position === EtaPos.EIN ? 'Ein' : 'Aus'}">${position}</value></eta>`,
      error: null,
    };
  };
  EtaApi.prototype.setUserVar = async (_id, value) => {
    writes++;
    position = value as EtaPos;
    return { result: 'ok', error: null };
  };

  try {
    let response = await POST(request({ id, expected: EtaPos.EIN, target: EtaPos.AUS }, 'https://attacker.example'));
    assert.equal(response.status, 403);
    response = await POST(new NextRequest(`http://localhost${API.ETA_HEATING_CIRCUIT}`, {
      method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: '{',
    }));
    assert.equal(response.status, 400);
    response = await POST(request({ id, expected: EtaPos.EIN, target: EtaPos.EIN }));
    assert.equal(response.status, 400);
    response = await POST(request({ id: '/1/2/3/4/5', expected: EtaPos.EIN, target: EtaPos.AUS }));
    assert.equal(response.status, 409);
    assert.equal(reads, 0);
    assert.equal(writes, 0);

    response = await POST(request({ id, expected: EtaPos.AUS, target: EtaPos.EIN }));
    assert.equal(response.status, 409);
    assert.equal(writes, 0);
    assert.equal(getServerStore().getState().eta.data[id].value, EtaPos.EIN);

    response = await POST(request({ id, expected: EtaPos.EIN, target: EtaPos.AUS }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.value, EtaPos.AUS);
    assert.equal(getServerStore().getState().eta.data[id].value, EtaPos.AUS);
    assert.equal(writes, 1);
  } finally {
    EtaApi.prototype.getUserVar = originalRead;
    EtaApi.prototype.setUserVar = originalWrite;
    globalThis.fetch = originalFetch;
  }
  console.log('PASS: heating circuit API authorizes, validates and uses simulated ETA reads and writes');
}

runTests().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
