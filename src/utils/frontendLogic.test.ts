import { collectWeatherChannels, reconcileVisibleChannels } from './weatherChartUtils';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

const channels = collectWeatherChannels([
  { channels: { ch8: {}, ch2: {} } },
  { channels: { ch1: {}, ch5: {} } },
]);

assert(channels.join(',') === 'ch1,ch2,ch5,ch8', 'weather channels are combined across every data point and sorted');
assert(
  reconcileVisibleChannels(['ch1', 'ch2', 'ch3', 'ch4', 'ch5'], null).join(',') === 'ch1,ch2,ch3,ch4',
  'the first weather dataset initializes at most four visible channels',
);
assert(
  reconcileVisibleChannels(['ch1', 'ch2'], []).length === 0,
  'an explicit empty channel selection remains empty',
);
assert(
  reconcileVisibleChannels(['ch1'], ['ch1', 'ch8']).join(',') === 'ch1',
  'removed weather channels are pruned from the current selection',
);
