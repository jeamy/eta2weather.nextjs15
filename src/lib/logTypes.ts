export const LOG_TYPES = ['ecowitt', 'eta', 'config', 'temp_diff', 'min_temp_status'] as const;
export type LogType = typeof LOG_TYPES[number];

export const LOG_TABLES: Record<LogType, string> = {
  ecowitt: 'ecowitt_logs',
  eta: 'eta_logs',
  config: 'config_logs',
  temp_diff: 'temp_diff_logs',
  min_temp_status: 'min_temp_status_logs',
};

export function isLogType(value: string): value is LogType {
  return LOG_TYPES.includes(value as LogType);
}

export function getLogExtension(type: LogType): 'xml' | 'json' | 'jsonl' {
  if (type === 'config') return 'json';
  if (type === 'temp_diff' || type === 'min_temp_status') return 'jsonl';
  return 'xml';
}
