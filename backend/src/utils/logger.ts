/* Minimal structured logger — one JSON line per event, no PII. */
type Level = 'debug' | 'info' | 'warn' | 'error';

function serialize(meta: unknown): unknown {
  if (meta instanceof Error) return { name: meta.name, message: meta.message, stack: meta.stack };
  return meta;
}

function write(level: Level, message: string, meta?: unknown): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta !== undefined ? { meta: serialize(meta) } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'warn') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export const logger = {
  debug: (m: string, meta?: unknown) => write('debug', m, meta),
  info: (m: string, meta?: unknown) => write('info', m, meta),
  warn: (m: string, meta?: unknown) => write('warn', m, meta),
  error: (m: string, meta?: unknown) => write('error', m, meta),
};
