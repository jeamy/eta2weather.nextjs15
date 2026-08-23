import { setHeatingMode } from './heatingMode';
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
}

runTests().catch(error => {
  console.error(error);
  process.exit(1);
});
