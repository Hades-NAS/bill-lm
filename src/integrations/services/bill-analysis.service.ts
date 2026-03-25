import { DateTime } from 'luxon'

import {
  enrichAnalysisMetadata,
  isValidAnalysis,
  transformRawToParsed,
} from '#/schema/bill-analysis'




import { AgentEngine } from '#/integrations/agent'
import { AppError, ErrorType, withRetry, CircuitBreaker } from '#/integrations/errors/error-handler'
import { adminDb } from '#/integrations/firebase/firebase.server'
import { LMStudio } from '#/integrations/lm-studio'
import { getServiceLogger } from '#/integrations/logger.server'
import { StorageHelper } from '#/integrations/minio/helper'
import { prisma } from '#/integrations/prisma'
import { BillPromptBuilder } from '#/integrations/prompts/bill-prompt-builder'
import { parseAndValidateInvoiceXML } from '#/integrations/xml'

import { roundToDecimals } from '#/utils/math'

import { FireCollections } from '#/constants/firebase'

import type {
  AnalyzedBill,
  AnalysisContext
} from '#/schema/bill-analysis'
import type { AnalyzeJobData } from '#/schema/collections'


const logger = getServiceLogger('BillAnalysisService')

export interface AnalysisResult {
  billId: string
  success: boolean
  analysis?: AnalyzedBill
  error?: string
}

export interface ServiceDependencies {
  maxRetries?: number
  updateProgressInterval?: number // ms between Firebase updates
}

/**
 * BillAnalysisService
 *
 * Orchestrates the analysis of bills.
 * Handles: model loading, XML parsing, prompt building, AI calls, DB updates.
 *
 * Features:
 * - Partial analysis: continues even if some bills fail
 * - Real-time Firestore updates
 * - Error handling with retries
 * - Circuit breaker protection
 * - Type-safe throughout
 */
export class BillAnalysisService {
  private logger = logger
  private promptBuilder: BillPromptBuilder
  private circuitBreaker: CircuitBreaker
  private maxRetries: number

  constructor(deps: ServiceDependencies = {}) {
    this.promptBuilder = new BillPromptBuilder()
    this.circuitBreaker = new CircuitBreaker(5, 60_000) // 5 failures, 60s timeout
    this.maxRetries = deps.maxRetries || 2
  }

  /**
   * Main entry point: analyze bills for a collection
   *
   * @param billIds - Bill IDs to analyze
   * @param jobData - Job metadata (with instructions, preset, etc)
   * @param context - Analysis context
   * @returns Array of analysis results (including partial successes)
   */
  async analyzeBills(
    billIds: Array<string>,
    jobData: AnalyzeJobData,
    context: AnalysisContext
  ): Promise<Array<AnalysisResult>> {
    this.logger.info('Starting bill analysis', {
      jobId: context.jobId,
      billCount: billIds.length,
      preset: context.preset,
    })

    try {
      // Step 1: Ensure model is loaded
      await this.ensureModelLoaded()

      // Step 2: Fetch bills from DB
      const bills = await this.fetchBillsForAnalysis(billIds)

      if (bills.length === 0) {
        throw new AppError(ErrorType.DATABASE, 'No bills found to analyze', { billIds })
      }

      // Step 3: Fetch and parse XML files
      const billsWithParsedData = await this.fetchAndParseXmls(bills)

      // Step 4: Analyze each bill (partial success allowed)
      const results = await this.analyzeEachBill(billsWithParsedData, jobData, context)

      // Step 5: Batch update database with results
      const successfulResults = results.filter((r) => r.success)
      if (successfulResults.length > 0) {
        await this.updateBillsInDatabase(successfulResults)
      }

      this.logger.info('Bill analysis completed', {
        jobId: context.jobId,
        total: results.length,
        successful: successfulResults.length,
        failed: results.length - successfulResults.length,
      })

      return results
    } catch (error) {
      this.logger.error('Critical error in bill analysis', {
        jobId: context.jobId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Ensure LLM model is loaded in LM Studio
   * @private
   */
  private async ensureModelLoaded(): Promise<void> {
    const hasModelLoaded = await LMStudio.hasModelLoaded(LMStudio.MODEL_KEY)

    if (hasModelLoaded) {
      this.logger.debug(`Model ${LMStudio.MODEL_KEY} already loaded`)
      return
    }

    this.logger.info(`Loading model ${LMStudio.MODEL_KEY} in LM Studio`)

    const response = await withRetry(
      () =>
        LMStudio.loadModel({
          model: LMStudio.MODEL_KEY,
          context_length: 8192,
          flash_attention: true,
        }),
      { maxRetries: this.maxRetries, backoff: 'exponential' },
      'Load LLM model'
    )

    if (!response) {
      throw new AppError(ErrorType.AI_ENGINE, `Failed to load model ${LMStudio.MODEL_KEY}`, {
        model: LMStudio.MODEL_KEY,
      })
    }

    this.logger.info(`Model ${LMStudio.MODEL_KEY} loaded successfully`)
  }

  /**
   * Fetch bills from database
   * @private
   */
  private async fetchBillsForAnalysis(billIds: Array<string>) {
    return await prisma.billHeader.findMany({
      where: { id: { in: billIds } },
      select: {
        id: true,
        billType: true,
        storagePath: true,
      },
    })
  }

  /**
   * Fetch XML files from Minio and parse them
   * @private
   */
  private async fetchAndParseXmls(
    bills: Array<{ id: string; billType: string; storagePath: string }>
  ) {
    const parsed = await Promise.all(
      bills.map(async (bill) => {
        try {
          const buffer = await StorageHelper.getObject(bill.storagePath)
          const result = parseAndValidateInvoiceXML(buffer)

          if (!result.success) {
            return {
              billId: bill.id,
              success: false,
              error: `XML parsing failed: ${result.error}`,
            }
          }

          const parsedBill = transformRawToParsed(result.data)
          return {
            billId: bill.id,
            success: true,
            parsedBill,
          }
        } catch (error) {
          return {
            billId: bill.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error fetching XML',
          }
        }
      })
    )

    return parsed
  }

  /**
   * Analyze each bill using AI
   * Updates Firestore progress after each bill
   * @private
   */
  private async analyzeEachBill(
    billsWithParsedData: Array<{
      billId: string
      success: boolean
      parsedBill?: any
      error?: string
    }>,
    jobData: AnalyzeJobData,
    context: AnalysisContext
  ): Promise<Array<AnalysisResult>> {
    const results: Array<AnalysisResult> = []

    for (const billData of billsWithParsedData) {
      const { billId, success, parsedBill, error } = billData

      if (!success || !parsedBill) {
        results.push({
          billId,
          success: false,
          error: error || 'Unknown parsing error',
        })
        continue
      }

      try {
        // Build prompt
        const prompt = this.promptBuilder.build(jobData, parsedBill)

        // Call AI Engine with circuit breaker protection
        const analysisOutput = await this.circuitBreaker.execute(
          () => AgentEngine.process(prompt, context.preset, {
            billId,
            jobId: context.jobId,
            promptVersion: this.promptBuilder.getVersion(),
          }),
          `Analyze bill ${billId}`
        )

        if (!analysisOutput) {
          throw new AppError(ErrorType.AI_ENGINE, 'AgentEngine returned null', { billId }, true)
        }

        // Enrich with metadata
        const analysis = enrichAnalysisMetadata(analysisOutput, this.promptBuilder.getVersion(), context.preset)

        // Validate
        if (!isValidAnalysis(analysis)) {
          throw new AppError(ErrorType.VALIDATION, 'Analysis validation failed', { analysis }, true)
        }

        results.push({
          billId,
          success: true,
          analysis,
        })

        this.logger.info(`Bill ${billId} analyzed successfully`, {
          jobId: context.jobId,
          percentage: analysis.percentage,
        })

        // Update Firestore with progress
        await this.updateFirestoreProgress(context.jobId, results.length, billsWithParsedData.length)
      } catch (_error) {
        this.logger.warn(`Failed to analyze bill ${billId}`, {
          jobId: context.jobId,
          error: _error instanceof Error ? _error.message : String(_error),
        })

        results.push({
          billId,
          success: false,
          error: _error instanceof Error ? _error.message : 'Unknown error',
        })
      }
    }

    return results
  }

  /**
   * Update Firestore with analysis progress
   * @private
   */
  private async updateFirestoreProgress(jobId: string, completed: number, total: number): Promise<void> {
    try {
      const percentage = roundToDecimals((completed / total) * 100)
      await adminDb.collection(FireCollections.ANALYZE_COLLECTION).doc(jobId).update({
        percentage,
        status: completed === total ? 'completed' : 'in-progress',
        updatedAt: DateTime.now().toJSDate(),
      })
    } catch (error) {
      this.logger.error('Failed to update Firestore progress', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      })
      // Don't throw - this is non-critical
    }
  }

  /**
   * Batch update bills in database with analysis results
   * @private
   */
  private async updateBillsInDatabase(results: Array<AnalysisResult>): Promise<void> {
    const validResults = results.filter(
      (r) => r.success && r.analysis
    ) as Array<AnalysisResult & { analysis: AnalyzedBill }>

    if (validResults.length === 0) {
      return
    }

    const updatedAt = DateTime.now().toJSDate()

    await prisma.$transaction(
      validResults.map(({ billId, analysis }) =>
        prisma.billHeader.update({
          where: { id: billId },
          data: {
            percentage: roundToDecimals(analysis.percentage, 0),
            reason: analysis.reason,
            updatedAt,
          },
        })
      )
    )

    this.logger.info(`Updated ${validResults.length} bills in database`)
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): 'closed' | 'open' | 'half-open' {
    return this.circuitBreaker.getState()
  }

  /**
   * Reset circuit breaker (manual recovery)
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset()
  }
}

/**
 * Factory function to create a BillAnalysisService instance
 */
export function createBillAnalysisService(deps?: ServiceDependencies): BillAnalysisService {
  return new BillAnalysisService(deps)
}
