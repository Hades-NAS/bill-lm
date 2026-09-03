import { Worker } from 'bullmq'
import { DateTime } from 'luxon'

import { adminDb } from '#/integrations/firebase/firebase.server'
import { createEnvironmentLLMProvider } from '#/integrations/llm/llm-provider-factory'
import { getServiceLogger } from '#/integrations/logger.server'
import { redisConnection } from '#/integrations/redis'

import { FireCollections } from '#/constants/firebase'

import type { AnalyzeJobData } from '#/schema/collections'
import type { Job } from 'bullmq'

import { env } from '#/env'
import { createAnalyzeBillsUseCase } from '#/use-cases/analyze-bills.use-case'

const logger = getServiceLogger('AnalyzeWorker')

logger.info(
  `Starting Analyze Worker connecting to Redis at ${redisConnection.host}:${redisConnection.port}`,
)

/**
 * Simplified job handler using AnalyzeBillsUseCase
 *
 * Responsibilities:
 * 1. Receive job from queue
 * 2. Delegate to use case for analysis
 * 3. Update final status in Firestore
 * 4. Handle errors gracefully
 */
export const jobHandler = async (job: Job<AnalyzeJobData>) => {
  const { jobId, data } = job.data
  const { billIds } = data

  try {
    logger.info(`[Worker] Processing job: ${jobId}`, {
      billCount: billIds.length,
      preset: data.preset,
    })

    // Resolve an immutable provider for this job only. The resolver currently
    // uses the deployment credential; Phase 1 will resolve job.data.credentialId.
    const provider = await createEnvironmentLLMProvider(env)
    const useCase = createAnalyzeBillsUseCase(provider)
    const results = await useCase.execute(
      billIds,
      job.data,
      data.preset || 'balanced',
    )

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.length - successCount

    logger.info(`[Worker] Job ${jobId} completed`, {
      total: results.length,
      successful: successCount,
      failed: failureCount,
    })

    // Update final status in Firestore
    await adminDb
      .collection(FireCollections.ANALYZE_COLLECTION)
      .doc(jobId)
      .update({
        status: failureCount === 0 ? 'completed' : 'failed',
        percentage: 100,
        updatedAt: DateTime.now().toJSDate(),
      })

    return true
  } catch (error) {
    logger.error(`[Worker] Job ${jobId} failed`, {
      error: error instanceof Error ? error.message : String(error),
    })

    // Update error status in Firestore
    try {
      await adminDb
        .collection(FireCollections.ANALYZE_COLLECTION)
        .doc(jobId)
        .update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: DateTime.now().toJSDate(),
        })
    } catch (updateError) {
      logger.error(`[Worker] Failed to update error status for job ${jobId}`, {
        error:
          updateError instanceof Error
            ? updateError.message
            : String(updateError),
      })
    }

    return null
  }
}

const worker = new Worker<AnalyzeJobData>(env.ANALYZE_QUEUE_NAME, jobHandler, {
  connection: redisConnection,
})

void worker
logger.info('Analyze Worker started and listening for jobs...')
