import type { RedisOptions } from 'bullmq'

import { env } from '#/env'

export const redisConnection: RedisOptions = {
  host: env.REDIS_HOST || 'redis',
  port: Number(env.REDIS_PORT || 6379),
  // password: env.REDIS_PASSWORD || undefined,
}
