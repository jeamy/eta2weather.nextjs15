import { NextRequest } from 'next/server';
import { POST as postBatchMenuData } from './eta/readBatchMenuData/route';
import { POST as updateEtaValue } from './eta/update/route';
import { POST as updateConfig } from './config/route';
import { GET as getWeather } from './weather/route';
import { defaultNames2Id, EtaConstants } from '@/reader/functions/types-constants/Names2IDconstants';
import { getConfig, names2idCache, NAMES2ID_CACHE_KEY } from '@/utils/cache';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function main(): Promise<void> {
  let response: Response = await getWeather(new Request('http://localhost/api/weather?range=90d'));
  assert(response.status === 400, 'weather route rejects unsupported time ranges');

  response = await postBatchMenuData(jsonRequest('http://localhost/api/eta/readBatchMenuData', {}));
  assert(response.status === 400, 'ETA batch route rejects a missing URI array');

  response = await postBatchMenuData(jsonRequest(
    'http://localhost/api/eta/readBatchMenuData',
    { uris: Array.from({ length: 501 }, (_, index) => `/test/${index}`) },
  ));
  assert(response.status === 413, 'ETA batch route enforces its maximum input size');

  response = await postBatchMenuData(jsonRequest(
    'http://localhost/api/eta/readBatchMenuData',
    { uris: [] },
  ));
  assert(response.status === 200, 'ETA batch route handles an empty request without contacting ETA');
  assert((await response.json()).success === true, 'empty ETA batch response has a successful contract');

  const config = await getConfig();
  names2idCache.set(`${NAMES2ID_CACHE_KEY}:${config.f_names2id || 'f_names2id.json'}`, defaultNames2Id);
  response = await updateEtaValue(jsonRequest(
    'http://localhost/api/eta/update',
    { id: '/test', value: 1 },
    { origin: 'https://attacker.example' },
  ));
  assert(response.status === 403, 'ETA write route rejects tokenless cross-origin requests');

  response = await updateEtaValue(jsonRequest(
    'http://localhost/api/eta/update',
    { value: 1 },
    { origin: 'http://localhost' },
  ));
  assert(response.status === 400, 'ETA write route validates required fields before network access');

  const modeId = defaultNames2Id[EtaConstants.AUTOTASTE].id.slice(1);
  for (const id of [modeId, `/user/var/${modeId}`, `https://example.invalid/user/var/${modeId}`, encodeURIComponent(`/user/var/${modeId}`)]) {
    response = await updateEtaValue(jsonRequest(
      'http://localhost/api/eta/update',
      { id, value: '1803' },
      { origin: 'http://localhost' },
    ));
    assert(response.status === 400, 'direct mode button writes are rejected before network access');
  }

  response = await updateConfig(jsonRequest(
    'http://localhost/api/config',
    { key: '__unknown_config_key__', value: true },
    { origin: 'http://localhost' },
  ));
  assert(response.status === 400, 'config route rejects unknown keys before persistence');
}

void main();
