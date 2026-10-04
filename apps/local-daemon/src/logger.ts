export type LocalDaemonLogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LocalDaemonLogger = {
  debug: (
    event: string,
    context?: Record<string, string | number | boolean | undefined>,
  ) => void
  info: (
    event: string,
    context?: Record<string, string | number | boolean | undefined>,
  ) => void
  warn: (
    event: string,
    context?: Record<string, string | number | boolean | undefined>,
  ) => void
  error: (
    event: string,
    context?: Record<string, string | number | boolean | undefined>,
  ) => void
}

const severity: Record<LocalDaemonLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

function configuredLevel(
  value = process.env.BILL_LM_LOCAL_LOG_LEVEL,
): LocalDaemonLogLevel {
  return value === 'debug' || value === 'warn' || value === 'error'
    ? value
    : 'info'
}

/**
 * Emits JSON Lines to the daemon terminal. Callers must pass only safe,
 * non-content metadata: never XML, prompts, model payloads, URLs, or secrets.
 */
export function createLocalDaemonLogger(
  level = configuredLevel(),
  write: (line: string) => void = (line) => console.info(line),
): LocalDaemonLogger {
  const log = (
    entryLevel: LocalDaemonLogLevel,
    event: string,
    context: Record<string, string | number | boolean | undefined> = {},
  ) => {
    if (severity[entryLevel] < severity[level]) return
    const fields = Object.fromEntries(
      Object.entries(context).filter(([, value]) => value !== undefined),
    )
    write(
      JSON.stringify({
        time: new Date().toISOString(),
        level: entryLevel,
        service: 'bill-lm-local-daemon',
        event,
        ...fields,
      }),
    )
  }

  return {
    debug: (event, context) => log('debug', event, context),
    info: (event, context) => log('info', event, context),
    warn: (event, context) => log('warn', event, context),
    error: (event, context) => log('error', event, context),
  }
}

export const silentLocalDaemonLogger: LocalDaemonLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}
