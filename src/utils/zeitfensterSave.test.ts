import assert from 'node:assert/strict';
import { commitTimeWindowEdits, removeConfirmedWindowEdits, TimeWindowEdit } from './zeitfensterSave';

async function main() {
  const edits: TimeWindowEdit[] = [
    { uri: '/a', start: '06:00', end: '08:00' },
    { uri: '/b', start: '06:00', end: '08:00' },
  ];
  let release: (() => void) | undefined;
  let resolved = false;
  let refreshed: string[] = [];
  const resultPromise = commitTimeWindowEdits(edits, async edit => {
    if (edit.uri === '/a') throw new Error('offline');
    await new Promise<void>(resolve => { release = resolve; });
  }, async uris => {
    refreshed = uris;
    return true;
  }).then(result => {
    resolved = true;
    return result;
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(resolved, false, 'partial failure waits for the other in-flight write');
  release?.();
  const result = await resultPromise;
  assert.deepEqual(refreshed, ['/b']);
  assert.deepEqual(result.confirmed.map(edit => edit.uri), ['/b']);
  assert.equal(result.failed.length, 1);

  const pending = {
    '/a': { start: '06:00', end: '08:00' },
    '/b': { start: '07:00', end: '09:00' },
  };
  assert.deepEqual(removeConfirmedWindowEdits(pending, result.confirmed), pending, 'newer edits are not cleared');
  assert.deepEqual(removeConfirmedWindowEdits({
    ...pending, '/b': { start: '06:00', end: '08:00' },
  }, result.confirmed), { '/a': pending['/a'] }, 'only confirmed, unchanged edits are cleared');

  const unreadable = await commitTimeWindowEdits(edits, async () => undefined, async () => false);
  assert.equal(unreadable.savedCount, 2);
  assert.equal(unreadable.readbackFailed, true);
  assert.deepEqual(unreadable.confirmed, [], 'failed readback preserves edits even if the writes succeeded');

  const failed = await commitTimeWindowEdits(edits, async () => { throw new Error('offline'); }, async () => {
    throw new Error('refresh must not be called');
  });
  assert.equal(failed.failed.length, 2);
  assert.equal(failed.savedCount, 0);
  assert.equal(failed.readbackFailed, false);
  console.log('PASS: time-window failures and concurrent edits do not discard unsaved input');
}

void main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
