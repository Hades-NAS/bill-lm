import { Worker } from 'bullmq'
import { DateTime } from 'luxon'

import { adminDb } from '#/integrations/firebase/firebase.server'
import { loadActiveFiscalReferenceContext } from '#/integrations/fiscal-references/context.server'
import { decryptProviderSecret } from '#/integrations/llm/byok-crypto.server'
import { LLMProviderFactory } from '#/integrations/llm/llm-provider-factory'
import { getServiceLogger } from '#/integrations/logger.server'
import { prisma } from '#/integrations/prisma'
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
    if (!run) throw new Error('The analysis run is no longer eligible')
    if (!run.ruleSetId || !run.collectionContextRevisionId)
      throw new Error('The analysis run has incomplete context')
    await prisma.analysisRun.update({
      where: { id: run.id },
      data: { status: 'running', startedAt: new Date() },
    })

    const [connection, collection, fiscalReferences, ruleSet] =
      await Promise.all([
        prisma.providerConnection.findFirst({
          where: { id: credentialId, userId, isActive: true, deletedAt: null },
        }),

        prisma.collection.findFirst({
          where: { id: data.collectionId, userId, deletedAt: null },
          select: { id: true },
        }),
        loadActiveFiscalReferenceContext(userId),
        prisma.taxRuleSet.findUnique({
          where: { id: run.ruleSetId },
          include: {
            fragments: {
              include: {
                fragment: {
                  include: {
                    source: { select: { issuer: true, title: true } },
                  },
                },
              },
            },
          },
        }),
      ])
    if (!connection || !collection)
      throw new Error('The job authorization is no longer valid')
    if (!ruleSet)
      throw new Error(
        'The ruleset fixed for this analysis is no longer available',
      )

    const officialReferences = ruleSet.fragments.map(({ fragment }) => ({
      name: `${fragment.source.issuer} — ${fragment.source.title} · ${fragment.articleOrSection}`,
      markdown: fragment.contentMarkdown,
    }))

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
    const results = await useCase.execute(
      billIds,
      job.data,
      data.preset || 'balanced',
      fiscalReferences,
      officialReferences,
    )

    const runContext = await prisma.collectionContextRevision.findFirst({
      where: { id: run.collectionContextRevisionId, userId },
    })
    if (!runContext) throw new Error('The analysis context is no longer valid')
    await prisma.analysisResult.createMany({
      data: results.map((result) => ({
        runId: run.id,
        billId: result.billId,
        purpose: runContext.purpose,
        classification: result.success ? 'needs_review' : 'ineligible',
        resultSnapshot: {
          schemaVersion: 'v2',
          runId: run.id,
          invoiceId: result.billId,
          purpose: runContext.purpose,
          classification: result.success ? 'needs_review' : 'ineligible',
          reasoning: result.success
            ? (result.analysis?.reason ?? '')
            : (result.error ?? 'Error de análisis'),
          uncertainties: result.success
            ? ['Resultado legacy pendiente de adaptación por propósito.']
            : [result.error ?? 'Error de análisis'],
        },
      })),
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
    if (job.data.analysisRunId)
      await prisma.analysisRun.updateMany({
        where: {
          id: job.data.analysisRunId,
          userId,
          status: { in: ['queued', 'running'] },
        },
        data: { status: 'failed', completedAt: new Date() },
      })

    // Update error status in Firestore
    try {
      await adminDb
        .collection(FireCollections.ANALYZE_COLLECTION)
        .doc(jobId)
        .update({
          status: 'failed',
          error: 'No se pudo completar el análisis.',
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
