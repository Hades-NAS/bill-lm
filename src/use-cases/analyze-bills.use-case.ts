import { createBillAnalysisService } from '#/integrations/services/bill-analysis.service'

import type { ILLMProvider } from '#/integrations/llm/provider.interface'
import type { AnalysisResult } from '#/integrations/services/bill-analysis.service'
import type { ParsedBill } from '#/schema/bill-analysis'
import type { AnalyzeJobData, PresetType } from '#/schema/collections'
import type { AnalysisExecutionEnvelope } from '#/schema/tax-analysis'

export class AnalyzeBillsUseCase {
  constructor(private provider: ILLMProvider) {}

  async execute(
    bills: Array<{ billId: string; parsedBill: ParsedBill }>,
    jobData: AnalyzeJobData,
    preset: PresetType = 'balanced',
    envelope: AnalysisExecutionEnvelope,
  ): Promise<Array<AnalysisResult>> {
    const runId = jobData.analysisRunId
    if (!runId)
      throw new Error('El trabajo no tiene una ejecución de análisis asociada.')

    return createBillAnalysisService({ provider: this.provider }).analyzePreparedBills(
      bills,
      jobData,
      { jobId: jobData.jobId, preset },
      envelope,
      runId,
    )
  }
}

export function createAnalyzeBillsUseCase(provider: ILLMProvider): AnalyzeBillsUseCase {
  return new AnalyzeBillsUseCase(provider)
}
