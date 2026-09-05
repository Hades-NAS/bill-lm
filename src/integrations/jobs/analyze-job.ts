import { Worker } from 'bullmq'
import { DateTime } from 'luxon'

import { adminDb } from '#/integrations/firebase/firebase.server'
import { decryptProviderSecret } from '#/integrations/llm/byok-crypto.server'
import { LLMProviderFactory } from '#/integrations/llm/llm-provider-factory'
import { getServiceLogger } from '#/integrations/logger.server'
import { prisma } from '#/integrations/prisma'
import { redisConnection } from '#/integrations/redis'
import {
  AnalysisPrerequisiteError,
  assertAnalysisEnvelopeCanExecute,
  assertEnvelopeMatchesAnalysisRun,
  assertFrozenProviderConnection,
} from '#/integrations/tax-analysis/analysis-gate'
import { parseAnalysisExecutionEnvelope } from '#/integrations/tax-analysis/execution-envelope.server'

import { FireCollections } from '#/constants/firebase'

import type { AnalyzeJobData } from '#/schema/collections'
import type { Job } from 'bullmq'

import { env } from '#/env'
import { ParsedBillSchema } from '#/schema/bill-analysis'
import { createAnalyzeBillsUseCase } from '#/use-cases/analyze-bills.use-case'

const logger = getServiceLogger('AnalyzeWorker')

const markJobBlocked = async (jobId: string, message: string) => {
  try {
    await adminDb
      .collection(FireCollections.ANALYZE_COLLECTION)
      .doc(jobId)
      .update({
        status: 'blocked',
        error: message,
        updatedAt: DateTime.now().toJSDate(),
      })
  } catch {
    logger.error(`[Worker] Failed to update blocked status for job ${jobId}`)
  }
}

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
  const { jobId, data, credentialId, userId } = job.data
  const { billIds } = data

  try {
    logger.info(`[Worker] Processing job: ${jobId}`, {
      billCount: billIds.length,
      preset: data.preset,
    })

    if (!credentialId) throw new Error('The job has no provider connection')
    if (!job.data.analysisRunId) throw new Error('The job has no analysis run')

    const run = await prisma.analysisRun.findFirst({
      where: { id: job.data.analysisRunId, userId, status: 'queued' },
    })
    if (!run) return null

    let envelope
    try {
      envelope = parseAnalysisExecutionEnvelope(run.inputSnapshot)
    } catch {
      const message =
        'El contexto preparado para este análisis no es válido. Configúralo nuevamente antes de reintentar.'
      await prisma.analysisRun.updateMany({
        where: { id: run.id, userId, status: 'queued' },
        data: {
          status: 'blocked',
          blockCode: 'UNRESOLVED_ANALYSIS_CONFIGURATION',
          blockMessage: message,
          completedAt: new Date(),
        },
      })
      await markJobBlocked(jobId, message)
      return null
    }

    // Only one worker may advance this immutable run. This claim happens before
    // decrypting the provider secret or creating an LLM client.
    const claim = await prisma.analysisRun.updateMany({
      where: { id: run.id, userId, status: 'queued' },
      data: { status: 'running', startedAt: new Date() },
    })
    if (claim.count !== 1) return null

    assertEnvelopeMatchesAnalysisRun(envelope, run, data.collectionId)

    const [connection, collection] =
      await Promise.all([
        prisma.providerConnection.findFirst({
          where: { id: credentialId, userId, isActive: true, deletedAt: null },
        }),

        prisma.collection.findFirst({
          where: { id: data.collectionId, userId, deletedAt: null },
          select: { id: true },
        }),
      ])
    if (!collection)
      throw new AnalysisPrerequisiteError(
        'MISSING_COLLECTION_CONTEXT',
        'La colección ya no está disponible para ejecutar este análisis.',
      )
    assertAnalysisEnvelopeCanExecute(envelope)
    assertFrozenProviderConnection(envelope, connection)
    const apiKey = decryptProviderSecret(
      {
        ciphertext: connection.secretCiphertext,
        iv: connection.secretIv,
        authTag: connection.secretAuthTag,
      },
      {
        userId,
        connectionId: connection.id,
        provider: connection.provider.toLowerCase(),
        version: connection.secretVersion,
      },
    )
    const provider = new LLMProviderFactory().create({
      provider: connection.provider.toLowerCase() as 'openai' | 'claude',
      modelId: connection.modelId,
      apiKey,
      maxTokens: parseInt(env.LLM_MAX_TOKENS ?? '2048'),
      timeout: parseInt(env.LLM_TIMEOUT_MS ?? '30000'),
      agentInstructions: '',
    })
    const useCase = createAnalyzeBillsUseCase(provider)
    const results = await useCase.executePrepared(
      envelope.invoices.map((invoice) => ({
        billId: invoice.billId,
        parsedBill: ParsedBillSchema.parse(invoice.normalized),
      })),
      job.data,
      data.preset || 'balanced',
      envelope,
    )

    await prisma.analysisResult.createMany({
      data: results.flatMap((result) => {
        if (!result.success || !result.result) return []
        return [{
          runId: run.id,
          billId: result.billId,
          purpose: result.result.purpose,
          classification: result.result.classification,
          resultSnapshot: JSON.parse(JSON.stringify(result.result)),
        }]
      }),
      skipDuplicates: true,
    })

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
    await prisma.analysisRun.update({
      where: { id: run.id },
      data: {
        status: failureCount === 0 ? 'completed' : 'failed',
        completedAt: new Date(),
      },
    })

    return true
  } catch (error) {
    logger.error(`[Worker] Job ${jobId} failed`)
    const prerequisiteError =
      error instanceof AnalysisPrerequisiteError ? error : null
    if (job.data.analysisRunId)
      await prisma.analysisRun.updateMany({
        where: {
          id: job.data.analysisRunId,
          userId,
          status: prerequisiteError ? 'running' : { in: ['queued', 'running'] },
        },
        data: prerequisiteError
          ? {
              status: 'blocked',
              blockCode: prerequisiteError.code,
              blockMessage: prerequisiteError.message,
              completedAt: new Date(),
            }
          : { status: 'failed', completedAt: new Date() },
      })

    // Update error status in Firestore
    try {
      await adminDb
        .collection(FireCollections.ANALYZE_COLLECTION)
        .doc(jobId)
        .update({
          status: prerequisiteError ? 'blocked' : 'failed',
          error: prerequisiteError?.message ?? 'No se pudo completar el análisis.',
          updatedAt: DateTime.now().toJSDate(),
        })
    } catch (updateError) {
      logger.error(
        `[Worker] Failed to update error status for job ${jobId}`,
        {},
      )
    }

    return null
  }
}

const worker = new Worker<AnalyzeJobData>(env.ANALYZE_QUEUE_NAME, jobHandler, {
  connection: redisConnection,
})

void worker
logger.info('Analyze Worker started and listening for jobs...')
