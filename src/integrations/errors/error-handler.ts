import { getServiceLogger } from '../logger.server'

const logger = getServiceLogger('ErrorHandler')

export enum ErrorType {
  VALIDATION = 'VALIDATION',
  STORAGE = 'STORAGE',
  AI_ENGINE = 'AI_ENGINE',
  DATABASE = 'DATABASE',
  NETWORK = 'NETWORK',
}

export class AppError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public context?: Record<string, unknown>,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = 'AppError'
  }

  static isRetryable(error: unknown): boolean {
    if (error instanceof AppError) {
      return error.retryable
    }
    return false
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      context: this.context,
      retryable: this.retryable,
    }
  }
}

export interface RetryOptions {
  maxRetries: number
  backoff: 'exponential' | 'linear'
  initialDelayMs?: number
  maxDelayMs?: number
}

function calculateBackoff(
  attempt: number,
  type: 'exponential' | 'linear',
  initialDelay = 1000,
  maxDelay = 30000
): number {
  const delayNumber = type === 'exponential'
    ? Math.min(initialDelay * Math.pow(2, attempt), maxDelay)
    : Math.min(initialDelay + initialDelay * attempt, maxDelay)

  // Add jitter: ±10% of delay
  const jitter = delayNumber * 0.1 * (Math.random() - 0.5)
  return Math.max(100, delayNumber + jitter)
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
  operationName: string = 'Operation'
): Promise<T> {
  const { maxRetries, backoff, initialDelayMs = 1000, maxDelayMs = 30000 } = options
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`${operationName}: attempt ${attempt + 1}/${maxRetries + 1}`)
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        const isRetryable = AppError.isRetryable(error) || attempt < maxRetries
        if (!isRetryable) {
          logger.error(`${operationName}: not retryable, throwing`, { error: lastError.message })
          throw lastError
        }

        const backoffMs = calculateBackoff(attempt, backoff, initialDelayMs, maxDelayMs)
        logger.warn(`${operationName}: attempt ${attempt + 1} failed, retrying in ${backoffMs}ms`, {
          error: lastError.message,
          attempt: attempt + 1,
          maxRetries,
        })

        await delay(backoffMs)
      }
    }
  }

  logger.error(`${operationName}: all ${maxRetries + 1} attempts failed`, {
    error: lastError?.message,
  })

  throw lastError || new Error(`${operationName} failed after ${maxRetries + 1} attempts`)
}

export class CircuitBreaker {
  private failureCount = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private failureThreshold: number = 5,
    private resetTimeoutMs: number = 60_000
  ) { }

  async execute<T>(fn: () => Promise<T>, operationName: string = 'Operation'): Promise<T> {
    this.checkState()

    if (this.state === 'open') {
      logger.warn(`${operationName}: circuit breaker is OPEN, rejecting request`)
      throw new AppError(
        ErrorType.AI_ENGINE,
        `${operationName}: circuit breaker is open due to repeated failures`,
        { state: this.state },
        true // retryable
      )
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private checkState(): void {
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime
      if (timeSinceLastFailure > this.resetTimeoutMs) {
        logger.info('CircuitBreaker: transitioning from OPEN to HALF-OPEN')
        this.state = 'half-open'
        this.failureCount = 0
      }
    }
  }

  private onSuccess(): void {
    this.failureCount = 0
    if (this.state === 'half-open') {
      logger.info('CircuitBreaker: transitioning from HALF-OPEN to CLOSED')
      this.state = 'closed'
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    logger.warn(`CircuitBreaker: failure count ${this.failureCount}/${this.failureThreshold}`, {
      failureCount: this.failureCount,
      threshold: this.failureThreshold,
    })

    if (this.failureCount >= this.failureThreshold) {
      logger.error('CircuitBreaker: transitioning to OPEN due to failure threshold')
      this.state = 'open'
    }
  }

  getState(): 'closed' | 'open' | 'half-open' {
    this.checkState()
    return this.state
  }

  reset(): void {
    logger.info('CircuitBreaker: manual reset')
    this.failureCount = 0
    this.state = 'closed'
  }
}
