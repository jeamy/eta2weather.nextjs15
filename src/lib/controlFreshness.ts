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

export function getFreshFlowTemperature(data: EtaData, id: string | undefined, now: number, maxAge: number): number | null {
  const flow = id ? data[id] : undefined;
  const readAt = Number(flow?._readAt);
  if (!Number.isFinite(readAt) || readAt <= 0 || readAt > now || now - readAt > maxAge) return null;
  const value = parseNum(flow?.strValue);
  return value !== null && Number.isFinite(value) ? value : null;
}

export function hasFreshControlEtaData(data: EtaData, names: Names2Id, menu: MenuNode[]): boolean {
  const get = (key: EtaConstants) => data[names[key]?.id];
  if (MODE_KEYS.some(key => {
    const value = get(key)?.value;
    return value !== EtaPos.EIN && value !== EtaPos.AUS;
  })) return false;

  const slider = parseNum(get(EtaConstants.SCHIEBERPOS)?.strValue);
  if (slider === null || !Number.isFinite(slider)) return false;

  if ([EtaConstants.EIN_AUS_TASTE, EtaConstants.SCHALTZUSTAND].some(key => {
    const value = get(key)?.strValue?.trim();
    return value !== 'Ein' && value !== 'Aus';
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
