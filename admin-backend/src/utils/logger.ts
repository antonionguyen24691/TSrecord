type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogPayload = Record<string, unknown>;

const write = (level: LogLevel, message: string, meta: LogPayload = {}) => {
  const entry = {
    level,
    message,
    service: 'tsrecord-admin',
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
};

export const logger = {
  debug: (message: string, meta?: LogPayload) => write('debug', message, meta),
  info: (message: string, meta?: LogPayload) => write('info', message, meta),
  warn: (message: string, meta?: LogPayload) => write('warn', message, meta),
  error: (message: string, meta?: LogPayload) => write('error', message, meta),
};
