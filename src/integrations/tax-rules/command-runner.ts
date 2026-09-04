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

export function summarizeTaxRuleBatch(results: TaxRuleBatchResult[]) {
  return {
    total: results.length,
    completed: results.filter((result) => result.status === 'completed').length,
    failed: results.filter((result) => result.status === 'failed').length,
  }
}
