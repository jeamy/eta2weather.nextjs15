import { getTimeRangeHours, isTimeRange } from './dbHelpers';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
  console.log(`PASS: ${message}`);
}

assert(isTimeRange('30d'), '30d is accepted as a weather time range');
assert(!isTimeRange('90d'), 'unknown weather time ranges are rejected');
assert(getTimeRangeHours('30d') === 720, '30d queries exactly 30 days');
assert(
  getTimeRangeHours('1m', new Date(2026, 5, 15, 12)) === 31 * 24,
  '1m uses calendar-month duration',
);
