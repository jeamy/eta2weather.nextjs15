import { BackgroundService } from './backgroundService';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

const service = BackgroundService.getInstance();
service.setManualOverride(true, 1234);
assert(service.getControlStatus().manualOverride === true, 'manual UI action immediately activates the server override');
assert(service.getControlStatus().manualOverrideTime === 1234, 'manual override keeps the server-side activation time');

service.setManualOverride(false);
assert(service.getControlStatus().manualOverride === false, 'Auto action immediately clears the server override');
assert(service.getControlStatus().manualOverrideTime === null, 'cleared override removes the server-side activation time');
