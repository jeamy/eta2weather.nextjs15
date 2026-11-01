import { EtaData, EtaPos } from '@/reader/functions/types-constants/EtaConstants';
import { EtaConstants, Names2Id } from '@/reader/functions/types-constants/Names2IDconstants';
import { MenuNode } from '@/types/menu';
import { parseNum } from '@/utils/numberParser';
import { findHeatingTimeNode, parseTimeWindow } from '@/utils/etaUtils';
import { DEFAULT_UPDATE_TIMER } from '@/reader/functions/types-constants/TimerConstants';

const MODE_KEYS = [
  EtaConstants.HEIZENTASTE, EtaConstants.KOMMENTASTE, EtaConstants.AUTOTASTE,
  EtaConstants.GEHENTASTE, EtaConstants.ABSENKTASTE,
];

export function getMaxFreshDataAge(updateTimer: string | undefined, minimum: number): number {
  return Math.max((parseInt(updateTimer || '', 10) || DEFAULT_UPDATE_TIMER) * 2, minimum);
}

export function getWifiMeasurementTime(outdoorTime: unknown, indoorTime: unknown): number | null {
  const timestamps = [outdoorTime, indoorTime].map(value => Number(value) * 1000);
  return timestamps.some(time => !Number.isFinite(time) || time <= 0) ? null : Math.min(...timestamps);
}

export function getFreshWifiMeasurementTime(
  outdoorTime: unknown,
  indoorTime: unknown,
  now: number,
  maxAge: number,
): number | null {
  const oldest = getWifiMeasurementTime(outdoorTime, indoorTime);
  const newest = Math.max(Number(outdoorTime) * 1000, Number(indoorTime) * 1000);
  if (oldest === null || newest > now + 60000 || now - oldest > maxAge) {
    return null;
  }
  return oldest;
}

export function hasFreshControlEtaData(data: EtaData, names: Names2Id, menu: MenuNode[]): boolean {
  const get = (key: EtaConstants) => data[names[key]?.id];
  if (MODE_KEYS.some(key => {
    const value = get(key)?.value;
    return value !== EtaPos.EIN && value !== EtaPos.AUS;
  })) return false;

  if ([EtaConstants.SCHIEBERPOS, EtaConstants.VORLAUFTEMP].some(key => {
    const value = parseNum(get(key)?.strValue);
    return value === null || !Number.isFinite(value);
  })) return false;

  if ([EtaConstants.EIN_AUS_TASTE, EtaConstants.SCHALTZUSTAND].some(key => {
    const value = get(key)?.strValue?.trim();
    return !value || value === 'N/A';
  })) return false;

  const visit = (node: MenuNode): boolean => {
    if (/Zeitfenster\s+\d+/.test(node.name)) {
      const value = data[node.uri]?.strValue;
      if (!value || !parseTimeWindow(value)) return false;
    }
    return (node.children || []).every(visit);
  };
  const schedule = findHeatingTimeNode(menu);
  return !schedule || visit(schedule);
}
