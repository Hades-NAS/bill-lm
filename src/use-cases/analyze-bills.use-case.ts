import { DateTime } from 'luxon'

import { AnalysisContextSchema } from '#/schema/bill-analysis'

import { adminDb } from '#/integrations/firebase/firebase.server'
import { getServiceLogger } from '#/integrations/logger.server'
import { createBillAnalysisService } from '#/integrations/services/bill-analysis.service'

import { FireCollections } from '#/constants/firebase'

import type { AnalysisResult } from '#/integrations/services/bill-analysis.service'
import type { AnalyzeJobData, PresetType } from '#/schema/collections'

const logger = getServiceLogger('AnalyzeBillsUseCase')

/**
 * AnalyzeBillsUseCase
 *
 * Orchestrates the analysis of bills independent of delivery mechanism.
 * This use case can be invoked from:
 * - BullMQ Worker (async background jobs)
 * - tRPC endpoints (if needed for sync analysis)
 * - CLI commands
 * - Cron jobs
 *
 * The logic is decoupled from the execution context.
 */
export class AnalyzeBillsUseCase {
  private logger = logger

  /**
   * Execute bill analysis
   *
   * @param billIds - Bills to analyze
   * @param jobData - Job data (collection info, instructions, etc)
   * @param preset - LLM preset (strict, balanced, creative)
   * @returns Array of analysis results
   */
  async execute(
    billIds: Array<string>,
    jobData: AnalyzeJobData,
    preset: PresetType = 'balanced',
  ): Promise<Array<AnalysisResult>> {
    const { jobId, userId, data: jobDataPayload } = jobData
    const { collectionId, collectionName } = jobDataPayload

    this.logger.info('AnalyzeBillsUseCase: starting', {
      jobId,
      userId,
      collectionId,
      billCount: billIds.length,
      preset,
    })

    try {
      // Build analysis context
      const context = AnalysisContextSchema.parse({
        jobId,
        billId: billIds[0], // Will be overridden per bill
        userId,
        collectionId,
        collectionName,
        preset,
        instructions: jobDataPayload.instructions,
      })

      // Create analysis service
      const analysisService = createBillAnalysisService()

      // Execute analysis
      const results = await analysisService.analyzeBills(
        billIds,
        jobData,
        context,
      )

      this.logger.info('AnalyzeBillsUseCase: analysis completed', {
        jobId,
        totalAnalyzed: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      })

      return results
    } catch (error) {
      this.logger.error('AnalyzeBillsUseCase: error during analysis', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      })

      // Update Firestore with error status
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
        this.logger.error('Failed to update Firestore with error status', {
          jobId,
          error:
            updateError instanceof Error
              ? updateError.message
              : String(updateError),
        })
      }

      throw error
    }
  }

  /**
   * Execute and handle both success and error cases
   * Useful for worker that needs to always complete gracefully
   */
  async executeWithErrorHandling(
    billIds: Array<string>,
    jobData: AnalyzeJobData,
    preset: 'strict' | 'balanced' | 'creative' = 'balanced',
  ): Promise<{
    success: boolean
    results?: Array<AnalysisResult>
    error?: string
  }> {
    try {
      const results = await this.execute(billIds, jobData, preset)
      return { success: true, results }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      this.logger.error(
        'AnalyzeBillsUseCase: caught error in executeWithErrorHandling',
        {
          error: errorMessage,
        },
      )
      return { success: false, error: errorMessage }
    }
  }
}

/**
 * Factory function to create use case instance
 */
export function createAnalyzeBillsUseCase(): AnalyzeBillsUseCase {
  return new AnalyzeBillsUseCase()
}
