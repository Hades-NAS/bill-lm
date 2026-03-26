import { Queue } from 'bullmq'

import { redisConnection } from '#/integrations/redis'

import type { AnalyzeJobData } from '#/schema/collections'

import { env } from '#/env'

export const AnalyzeQueue = new Queue<AnalyzeJobData, boolean, string>(
  env.ANALYZE_QUEUE_NAME,
  {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  },
)
