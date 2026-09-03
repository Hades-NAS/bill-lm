import pino from 'pino'

import { env } from '#/env'

const isDevelopment = env.NODE_ENV !== 'production'

export const logger = pino({
  level: isDevelopment ? 'debug' : 'info',
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

const secretKeyPattern = /^(api[-_]?key|authorization|secret|token|password)$/i
const apiKeyValuePattern = /\b(sk-(?:ant-)?[A-Za-z0-9_-]{8,})\b/g

export function sanitizeLogValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(apiKeyValuePattern, '[REDACTED]')
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeLogValue)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        secretKeyPattern.test(key) ? '[REDACTED]' : sanitizeLogValue(nestedValue),
      ]),
    )
  }

  return value
}

function parseArgs(args: Array<unknown>): string {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!args || args.length === 0) return ''

  return args
    .map((arg) => {
      if (typeof arg === 'string') return ` ${sanitizeLogValue(arg)}`
      try {
        return ` ${JSON.stringify(sanitizeLogValue(arg))}`
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
