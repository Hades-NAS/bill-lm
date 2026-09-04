import { TaxRuleAcquisitionError } from './acquisition.server'

export class TaxRuleCommandError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaxRuleCommandError'
  }
}

export type TaxRuleBatchResult = {
  sourceId: string
  status: 'completed' | 'failed'
  detail?: unknown
  message?: string
}

export type TaxRulePipelineStage<T extends { id: string }> = {
  name: string
  run: (source: T) => Promise<unknown>
}

type TaxRulePipelineStageResult = {
  name: string
  status: 'completed'
  detail: unknown
}

export function taxRuleUserFacingError(error: unknown) {
  if (error instanceof TaxRuleCommandError || error instanceof TaxRuleAcquisitionError)
    return error.message
  return 'No se pudo procesar la fuente. Revisa que el paso anterior haya terminado y vuelve a intentarlo.'
}

export async function runTaxRuleBatch<T extends { id: string }>(
  sources: T[],
  operation: (source: T) => Promise<unknown>,
): Promise<TaxRuleBatchResult[]> {
  const results: TaxRuleBatchResult[] = []
  for (const source of sources) {
    try {
      results.push({
        sourceId: source.id,
        status: 'completed',
        detail: await operation(source),
      })
    } catch (error) {
      results.push({
        sourceId: source.id,
        status: 'failed',
        message: taxRuleUserFacingError(error),
      })
    }
  }
  return results
}

/** Runs every stage for one source before continuing with the next source. */
export async function runTaxRulePipeline<T extends { id: string }>(
  sources: T[],
  stages: TaxRulePipelineStage<T>[],
): Promise<TaxRuleBatchResult[]> {
  const results: TaxRuleBatchResult[] = []

  for (const source of sources) {
    const completedStages: TaxRulePipelineStageResult[] = []
    let failed = false

    for (const stage of stages) {
      try {
        completedStages.push({
          name: stage.name,
          status: 'completed',
          detail: await stage.run(source),
        })
      } catch (error) {
        results.push({
          sourceId: source.id,
          status: 'failed',
          detail: { failedStage: stage.name, stages: completedStages },
          message: taxRuleUserFacingError(error),
        })
        failed = true
        break
      }
    }

    if (!failed)
      results.push({
        sourceId: source.id,
        status: 'completed',
        detail: { stages: completedStages },
      })
  }

  return results
}

export function summarizeTaxRuleBatch(results: TaxRuleBatchResult[]) {
  return {
    total: results.length,
    completed: results.filter((result) => result.status === 'completed').length,
    failed: results.filter((result) => result.status === 'failed').length,
  }
}
