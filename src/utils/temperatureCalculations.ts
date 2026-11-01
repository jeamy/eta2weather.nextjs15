import { TEMP_CALC_CONSTANTS } from '@/reader/functions/types-constants/ConfigConstants';

export function calculateLiveTemperatureDiff(soll: number, delta: number, indoor: number): number | null {
  if (![soll, delta, indoor].every(Number.isFinite)) return null;
  return Number((soll + delta / TEMP_CALC_CONSTANTS.DELTA_DAMPENING_FACTOR - indoor).toFixed(2));
}
