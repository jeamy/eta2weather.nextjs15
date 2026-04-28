type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 50,
};

function normalizeLogLevel(value: string | undefined): LogLevel {
  const level = value?.toLowerCase();
  if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error' || level === 'silent') {
    return level;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

export class Logger {
  private readonly level: LogLevel;

  constructor(private readonly component: string, level: LogLevel = normalizeLogLevel(process.env.LOG_LEVEL)) {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVELS[level] >= LEVELS[this.level];
  }

  private prefix(): string {
    return `[${new Date().toISOString()}] [${this.component}]`;
  }

  debug(message: string, ...args: unknown[]) {
    if (this.shouldLog('debug')) console.debug(this.prefix(), message, ...args);
  }

  info(message: string, ...args: unknown[]) {
    if (this.shouldLog('info')) console.log(this.prefix(), message, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    if (this.shouldLog('warn')) console.warn(this.prefix(), message, ...args);
  }

  error(message: string, ...args: unknown[]) {
    if (this.shouldLog('error')) console.error(this.prefix(), message, ...args);
  }
}

export function createLogger(component: string): Logger {
  return new Logger(component);
}
