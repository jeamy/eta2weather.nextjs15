import { NextRequest } from 'next/server';
import { requireWriteAccess } from './apiAuth';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

const previousToken = process.env.API_WRITE_TOKEN;
const previousOverride = process.env.ALLOW_UNAUTHENTICATED_WRITES;

delete process.env.API_WRITE_TOKEN;
delete process.env.ALLOW_UNAUTHENTICATED_WRITES;

const sameOrigin = new NextRequest('http://localhost/api/config', {
  method: 'POST',
  headers: { origin: 'http://localhost' },
});
assert(requireWriteAccess(sameOrigin) === null, 'same-origin UI writes remain allowed');

const crossOrigin = new NextRequest('http://localhost/api/config', {
  method: 'POST',
  headers: { origin: 'http://attacker.invalid' },
});
assert(requireWriteAccess(crossOrigin)?.status === 403, 'tokenless cross-origin writes are rejected');

process.env.API_WRITE_TOKEN = 'test-secret';
const tokenRequest = new NextRequest('http://localhost/api/config', {
  method: 'POST',
  headers: { 'x-api-token': 'test-secret' },
});
assert(requireWriteAccess(tokenRequest) === null, 'valid API token permits external writes');

if (previousToken === undefined) delete process.env.API_WRITE_TOKEN;
else process.env.API_WRITE_TOKEN = previousToken;
if (previousOverride === undefined) delete process.env.ALLOW_UNAUTHENTICATED_WRITES;
else process.env.ALLOW_UNAUTHENTICATED_WRITES = previousOverride;
