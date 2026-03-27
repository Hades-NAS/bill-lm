import pino from 'pino'

const isDevelopment = process.env.NODE_ENV !== 'production'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment
    ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    }
    : {
      target: 'pino-pretty',
      options: {
        colorize: false,
        translateTime: 'yyyy-mm-dd HH:MM:ss Z',
        ignore: 'hostname',
        crlf: true,
      },
    },
})

function parseArgs(args: Array<unknown>): string {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!args || args.length === 0) return ''

  return args
    .map((arg) => {
      if (typeof arg === 'string') return ` ${arg}`
      try {
        return ` ${JSON.stringify(arg)}`
      } catch {
        return ` ${String(arg)}`
      }
    })
    .join(' ')
}

export function getServiceLogger(className: string) {
  // Converts "MyService" → "[MY_SERVICE]"
  const prefix = `[${className
    .replace(/([A-Z])/g, '_$1')
    .substring(1)
    .toUpperCase()}]`

  return {
    info: (msg: string, ...args: Array<unknown>) =>
      logger.info(`${prefix} ${msg}${parseArgs(args)}`),
    debug: (msg: string, ...args: Array<unknown>) =>
      logger.debug(`${prefix} ${msg}${parseArgs(args)}`),
    warn: (msg: string, ...args: Array<unknown>) =>
      logger.warn(`${prefix} ${msg}${parseArgs(args)}`),
    error: (msg: string, ...args: Array<unknown>) =>
      logger.error(`${prefix} ${msg}${parseArgs(args)}`),
  }
}
