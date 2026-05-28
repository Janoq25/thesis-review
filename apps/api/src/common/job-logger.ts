type LogLevel = 'log' | 'warn' | 'error' | 'debug';

function format(scope: string, message: string, meta?: Record<string, unknown>): string {
  const base = `[${scope}] ${message}`;
  if (!meta || Object.keys(meta).length === 0) return base;
  return `${base} ${JSON.stringify(meta)}`;
}

export function jobLog(scope: string, message: string, meta?: Record<string, unknown>): void {
  console.log(format(scope, message, meta));
}

export function jobWarn(scope: string, message: string, meta?: Record<string, unknown>): void {
  console.warn(format(scope, message, meta));
}

export function jobError(scope: string, message: string, meta?: Record<string, unknown>): void {
  console.error(format(scope, message, meta));
}

export function jobDebug(scope: string, message: string, meta?: Record<string, unknown>): void {
  if (process.env.JOB_DEBUG === 'true') {
    console.debug(format(scope, message, meta));
  }
}

export function logJobEvent(
  scope: string,
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
): void {
  if (level === 'error') jobError(scope, message, meta);
  else if (level === 'warn') jobWarn(scope, message, meta);
  else if (level === 'debug') jobDebug(scope, message, meta);
  else jobLog(scope, message, meta);
}
