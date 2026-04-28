import { ConfigKeys, TEMP_CALC_CONSTANTS } from '@/reader/functions/types-constants/ConfigConstants';
import { MIN_API_INTERVAL } from '@/reader/functions/types-constants/TimerConstants';

type ValidationResult =
  | { success: true; key: ConfigKeys; value: string | Record<string, string> }
  | { success: false; error: string };

const NUMERIC_RANGES: Partial<Record<ConfigKeys, { min: number; max: number }>> = {
  [ConfigKeys.T_SOLL]: { min: 5, max: 35 },
  [ConfigKeys.T_DELTA]: { min: -TEMP_CALC_CONSTANTS.MAX_DELTA_VALUE, max: TEMP_CALC_CONSTANTS.MAX_DELTA_VALUE },
  [ConfigKeys.T_SLIDER]: { min: -100, max: 100 },
  [ConfigKeys.T_SLIDER_BASE]: { min: -100, max: 100 },
  [ConfigKeys.T_UPDATE_TIMER]: { min: MIN_API_INTERVAL, max: 24 * 60 * 60 * 1000 },
  [ConfigKeys.DIFF]: { min: -100, max: 100 },
  [ConfigKeys.T_MIN]: { min: 5, max: 35 },
  [ConfigKeys.TEMP_DIFF]: { min: -100, max: 100 },
  [ConfigKeys.T_OVERRIDE]: { min: 0, max: 24 * 60 * 60 * 1000 },
};

const FILE_KEYS = new Set<ConfigKeys>([
  ConfigKeys.F_ETA,
  ConfigKeys.F_WIFIAF83,
  ConfigKeys.F_NAMES2ID,
]);

function normalizeStringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function validateNumericKey(key: ConfigKeys, value: unknown, range: { min: number; max: number }): ValidationResult {
  const normalized = normalizeStringValue(value);
  if (!normalized) {
    return { success: false, error: `${key} darf nicht leer sein` };
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return { success: false, error: `${key} muss eine Zahl sein` };
  }

  if (parsed < range.min || parsed > range.max) {
    return { success: false, error: `${key} muss zwischen ${range.min} und ${range.max} liegen` };
  }

  return { success: true, key, value: normalized };
}

function validateEtaEndpoint(value: unknown): ValidationResult {
  const raw = normalizeStringValue(value);
  if (!raw) {
    return { success: false, error: `${ConfigKeys.S_ETA} darf nicht leer sein` };
  }

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`);
    if (!url.hostname || url.pathname !== '/' || url.search || url.hash) {
      return { success: false, error: `${ConfigKeys.S_ETA} muss host[:port] enthalten` };
    }
    return { success: true, key: ConfigKeys.S_ETA, value: /^https?:\/\//i.test(raw) ? url.origin : url.host };
  } catch {
    return { success: false, error: `${ConfigKeys.S_ETA} enthaelt eine ungueltige Serveradresse` };
  }
}

function validateFileName(key: ConfigKeys, value: unknown): ValidationResult {
  const normalized = normalizeStringValue(value);
  if (!normalized || normalized.startsWith('/') || normalized.includes('..')) {
    return { success: false, error: `${key} muss ein relativer Dateiname ohne '..' sein` };
  }
  return { success: true, key, value: normalized };
}

function validateChannelNames(value: unknown): ValidationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { success: false, error: `${ConfigKeys.CHANNEL_NAMES} muss ein Objekt sein` };
  }

  const normalized: Record<string, string> = {};
  for (const [channel, label] of Object.entries(value)) {
    const channelKey = channel.trim();
    if (!/^CH\d+$/.test(channelKey)) {
      return { success: false, error: `Ungueltiger Kanalname: ${channel}` };
    }
    normalized[channelKey] = normalizeStringValue(label);
  }

  return { success: true, key: ConfigKeys.CHANNEL_NAMES, value: normalized };
}

export function validateConfigPatch(rawKey: unknown, rawValue: unknown): ValidationResult {
  if (typeof rawKey !== 'string' || !Object.values(ConfigKeys).includes(rawKey as ConfigKeys)) {
    return { success: false, error: `Unbekannter Config-Key: ${String(rawKey)}` };
  }

  const key = rawKey as ConfigKeys;
  const numericRange = NUMERIC_RANGES[key];
  if (numericRange) {
    return validateNumericKey(key, rawValue, numericRange);
  }

  if (key === ConfigKeys.DELTA_OVERRIDE) {
    const normalized = normalizeStringValue(rawValue).toLowerCase();
    if (normalized !== 'true' && normalized !== 'false') {
      return { success: false, error: `${key} muss true oder false sein` };
    }
    return { success: true, key, value: normalized };
  }

  if (key === ConfigKeys.S_ETA) {
    return validateEtaEndpoint(rawValue);
  }

  if (FILE_KEYS.has(key)) {
    return validateFileName(key, rawValue);
  }

  if (key === ConfigKeys.CHANNEL_NAMES) {
    return validateChannelNames(rawValue);
  }

  return { success: false, error: `Kein Validator fuer Config-Key: ${key}` };
}
