import { Config, ConfigKeys, TEMP_CALC_CONSTANTS } from '@/reader/functions/types-constants/ConfigConstants';
import { parseNum } from '@/utils/numberParser';

export function calculateAutomaticDelta(
  config: Config,
  etaOutdoor: string | undefined,
  wifiOutdoor: number,
): string | null {
  if (config[ConfigKeys.DELTA_OVERRIDE] === 'true') return null;

  const etaTemperature = parseNum(etaOutdoor);
  if (etaTemperature === null || !Number.isFinite(etaTemperature) || !Number.isFinite(wifiOutdoor)) {
    return null;
  }

  const difference = etaTemperature - wifiOutdoor;
  if (Math.abs(difference) > TEMP_CALC_CONSTANTS.MAX_DELTA_VALUE) return null;

  const rounded = Number(difference.toFixed(1));
  const current = Number(config[ConfigKeys.T_DELTA]);
  if (Number.isFinite(current) && Math.abs(rounded - current) <= 0.1 + 1e-9) return null;

  return rounded.toFixed(1);
}
