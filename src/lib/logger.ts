type LoggerFn = (...args: unknown[]) => void;

function isDebugEnabled(): boolean {
  // Client: NEXT_PUBLIC_*
  if (process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') return true;
  // Server: allow non-public flag too
  if (process.env.DEBUG_LOGS === 'true') return true;
  return false;
}

const DEBUG_ENABLED = isDebugEnabled();

export const logger: {
  debug: LoggerFn;
  info: LoggerFn;
  warn: LoggerFn;
  error: LoggerFn;
} = {
  debug: (...args) => {
    if (!DEBUG_ENABLED) return;
    // eslint-disable-next-line no-console
    console.log(...args);
  },
  info: (...args) => {
    if (!DEBUG_ENABLED) return;
    // eslint-disable-next-line no-console
    console.info(...args);
  },
  warn: (...args) => {
    // eslint-disable-next-line no-console
    console.warn(...args);
  },
  error: (...args) => {
    // eslint-disable-next-line no-console
    console.error(...args);
  },
};



