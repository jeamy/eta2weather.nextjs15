import { HeatingModeCancelledError, setHeatingMode } from './heatingMode';
import { updateSliderPosition } from '@/utils/Functions';
import { EtaApi } from '@/reader/functions/EtaApi';
import { EtaButtons } from '@/reader/functions/types-constants/EtaConstants';
import { defaultNames2Id } from '@/reader/functions/types-constants/Names2IDconstants';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`PASS: ${message}`);
}

async function runTests(): Promise<void> {
  const failingEtaApi = {
    setUserVar: async () => ({ result: null, error: 'offline' }),
  } as unknown as EtaApi;

  let modeWriteFailed = false;
  try {
    await setHeatingMode({
      targetButton: EtaButtons.AA,
      names2id: defaultNames2Id,
      etaApi: failingEtaApi,
    });
  } catch {
    modeWriteFailed = true;
  }
  assert(modeWriteFailed, 'heating mode reports ETA write failures');

  const originalConsoleError = console.error;
  console.error = () => undefined;
  const sliderResult = await updateSliderPosition(10, 0, defaultNames2Id, failingEtaApi);
  console.error = originalConsoleError;
  assert(!sliderResult.success, 'slider update reports ETA write failures');
  assert(sliderResult.position === 0, 'failed slider update preserves the current position');

  let successfulWrites = 0;
  const successfulEtaApi = {
    setUserVar: async () => {
      successfulWrites += 1;
      return { result: 'ok', error: null };
    },
  } as unknown as EtaApi;
  await setHeatingMode({
    targetButton: EtaButtons.AA,
    names2id: defaultNames2Id,
    etaApi: successfulEtaApi,
  });
  assert(successfulWrites === 5, 'heating mode writes each non-target once and activates the target once');

  const beforeCancelled = successfulWrites;
  let cancelled = false;
  try {
    await setHeatingMode({
      targetButton: EtaButtons.KT,
      names2id: defaultNames2Id,
      etaApi: successfulEtaApi,
      shouldProceed: () => false,
    });
  } catch (error) {
    cancelled = error instanceof HeatingModeCancelledError;
  }
  assert(cancelled && successfulWrites === beforeCancelled, 'superseded queued mode changes do not write to ETA');

  let applied = false;
  await setHeatingMode({
    targetButton: EtaButtons.AA,
    names2id: defaultNames2Id,
    etaApi: successfulEtaApi,
    onApplied: () => { applied = true; },
  });
  assert(applied, 'the mode queue remains usable after cancellation');

  let releaseFirst: (() => void) | undefined;
  let writes = 0;
  let manualApplied = false;
  const slowApi = {
    setUserVar: async () => {
      writes++;
      if (writes === 1) await new Promise<void>(resolve => { releaseFirst = resolve; });
      return { result: 'ok', error: null };
    },
  } as unknown as EtaApi;
  const manualRequest = setHeatingMode({
    targetButton: EtaButtons.HT,
    names2id: defaultNames2Id,
    etaApi: slowApi,
    onApplied: () => { manualApplied = true; },
  });
  const automaticRequest = setHeatingMode({
    targetButton: EtaButtons.KT,
    names2id: defaultNames2Id,
    etaApi: slowApi,
    shouldProceed: () => !manualApplied,
  });
  await Promise.resolve();
  releaseFirst?.();
  await manualRequest;
  let superseded = false;
  try {
    await automaticRequest;
  } catch (error) {
    superseded = error instanceof HeatingModeCancelledError;
  }
  assert(superseded && writes === 5, 'a queued automatic mode change cannot undo a completed manual change');
}

runTests().catch(error => {
  console.error(error);
  process.exit(1);
});
