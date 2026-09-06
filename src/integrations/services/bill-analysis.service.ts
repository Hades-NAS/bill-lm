import { DateTime } from 'luxon'

import {
  AppError,
  CircuitBreaker,
  ErrorType,
  withRetry,
} from '#/integrations/errors/error-handler'
import { adminDb } from '#/integrations/firebase/firebase.server'
import { getServiceLogger } from '#/integrations/logger.server'
import { createBillPromptBuilder } from '#/integrations/prompts/bill-prompt-builder'
import {
  normalizeTaxAnalysisResult,
  referencesFromExecutionEnvelope,
} from '#/integrations/tax-analysis/result-adapter'

import { FireCollections } from '#/constants/firebase'

import type { ILLMProvider } from '#/integrations/llm/provider.interface'
import type { BillPromptBuilder } from '#/integrations/prompts/bill-prompt-builder'
import type { AnalyzeJobData } from '#/schema/collections'
import type {
  AnalysisExecutionEnvelope,
  TaxAnalysisResult,
} from '#/schema/tax-analysis'
import type { ParsedBill } from '#/schema/bill-analysis'

const logger = getServiceLogger('BillAnalysisService')

export interface AnalysisResult {
  billId: string
  success: boolean
  result?: TaxAnalysisResult
  error?: string
}

export interface ServiceDependencies {
  maxRetries?: number
  provider: ILLMProvider
}

export interface AnalysisExecutionContext {
  jobId: string
  preset: 'strict' | 'balanced' | 'creative'
}

export class BillAnalysisService {
  private logger = logger
  private promptBuilder: BillPromptBuilder
  private circuitBreaker = new CircuitBreaker(5, 60_000)
  private maxRetries: number
  private provider: ILLMProvider

  constructor(deps: ServiceDependencies) {
    this.promptBuilder = createBillPromptBuilder()
    this.maxRetries = deps.maxRetries || 2
    this.provider = deps.provider
  }

  async analyzePreparedBills(
    bills: Array<{ billId: string; parsedBill: ParsedBill }>,
    _jobData: AnalyzeJobData,
    context: AnalysisExecutionContext,
    envelope: AnalysisExecutionEnvelope,
    runId: string,
  ): Promise<Array<AnalysisResult>> {
    await this.ensureModelLoaded()
    const results: Array<AnalysisResult> = []

    for (const bill of bills) {
      try {
        const prompt = this.promptBuilder.build(envelope, bill.billId)
        const payload = await this.circuitBreaker.execute(
          () =>
            this.provider.process(prompt, context.preset, {
              billId: bill.billId,
              jobId: context.jobId,
              promptVersion: envelope.prompt.templateVersion,
            }),
          `Analyze bill ${bill.billId}`,
        )
        if (!payload)
          throw new AppError(
            ErrorType.AI_ENGINE,
            `${this.provider.getProviderName()} provider returned null for analysis`,
            { billId: bill.billId },
            true,
          )

        results.push({
          billId: bill.billId,
          success: true,
          result: normalizeTaxAnalysisResult({
            payload,
            purpose: envelope.context.purpose,
            runId,
            invoiceId: bill.billId,
            allowedActivityRevisionIds: envelope.activities.map(
              (activity) => activity.revisionId,
            ),
            references: referencesFromExecutionEnvelope(envelope),
          }),
        })
      } catch (error) {
        this.logger.warn(`Failed to analyze bill ${bill.billId}`, {
          jobId: context.jobId,
          error: error instanceof Error ? error.message : String(error),
        })
        results.push({
          billId: bill.billId,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Error desconocido durante el análisis.',
        })
      }
      await this.updateFirestoreProgress(
        context.jobId,
        results.length,
        bills.length,
      )
    }
    return results
  }

  private async ensureModelLoaded(): Promise<void> {
    const modelId = this.provider.getModelId()
    if (await this.provider.isModelLoaded()) return
    await withRetry(
      () => this.provider.loadModel(),
      { maxRetries: this.maxRetries, backoff: 'exponential' },
      `Load model ${modelId}`,
    )
  }

  private async updateFirestoreProgress(
    jobId: string,
    completed: number,
    total: number,
  ): Promise<void> {
    try {
      await adminDb
        .collection(FireCollections.ANALYZE_COLLECTION)
        .doc(jobId)
        .update({
          percentage: total === 0 ? 100 : Math.round((completed / total) * 100),
          status: completed === total ? 'completed' : 'in-progress',
          updatedAt: DateTime.now().toJSDate(),
        })
    } catch (error) {
      this.logger.error('Failed to update Firestore progress', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  getCircuitBreakerStatus(): 'closed' | 'open' | 'half-open' {
    return this.circuitBreaker.getState()
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker.reset()
  }
}

export function createBillAnalysisService(
  deps: ServiceDependencies,
): BillAnalysisService {
  return new BillAnalysisService(deps)
}
