type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

function isStringOrNumber(v: unknown): v is string | number {
  return typeof v === 'string' || typeof v === 'number';
}

export function formatLogMessageImpl(
  streamType: 'stdout' | 'stderr',
  message: Record<string, unknown>
): { level: LogLevel; message: Record<string, unknown> } {
  const level = message['level'];

  if (isStringOrNumber(level)) {
    if (level === 'trace' || level === 'verbose' || Number(level) === 10) {
      return { level: 'trace', message };
    } else if (level === 'debug' || Number(level) === 20) {
      return { level: 'debug', message };
    } else if (level === 'info' || Number(level) === 30) {
      return { level: 'info', message };
    } else if (level === 'warn' || Number(level) === 40) {
      return { level: 'warn', message };
    } else if (level === 'error' || Number(level) === 50) {
      return { level: 'error', message };
    } else if (level === 'fatal' || Number(level) === 60) {
      return { level: 'fatal', message };
    }
  }

  return { level: streamType === 'stderr' ? 'error' : 'info', message };
}
