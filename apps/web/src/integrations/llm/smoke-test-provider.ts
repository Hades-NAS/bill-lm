import type { LLMPreset } from '#/config/llm-config'
import type {
  AnalysisExecutionEnvelope,
  ModelTaxAnalysisPayload,
} from '#/schema/tax-analysis'
import type { ContextProcess, ILLMProvider } from './provider.interface'

/**
 * A deterministic provider used only by LLM_SMOKE_TEST. It is intentionally
 * not a proxy: no method that could contact the underlying provider is ever
 * delegated. The real provider is still constructed by the worker first, so
 * BYOK decryption and local client setup remain covered by the smoke flow.
 */
export class SmokeTestProvider implements ILLMProvider {
  constructor(
    private readonly provider: ILLMProvider,
    private readonly execution: Pick<
      AnalysisExecutionEnvelope,
      'context' | 'activities'
    >,
  ) {}

  getProviderName() {
    return this.provider.getProviderName()
  }

  getModelId() {
    return this.provider.getModelId()
  }

  async isEngineHealthy(): Promise<boolean> {
    return true
  }

  async isModelLoaded(): Promise<boolean> {
    return true
  }

  async loadModel(): Promise<void> {}

  async process(
    _prompt: string,
    _preset: LLMPreset,
    _context?: ContextProcess,
  ): Promise<ModelTaxAnalysisPayload> {
    const common = {
      classification: 'needs_review' as const,
      reasoning:
        'Resultado simulado para validar el flujo; no corresponde a un análisis tributario real.',
      uncertainties: [
        'La ejecución simulada no consultó al proveedor ni evaluó la factura.',
      ],
    }

    switch (this.execution.context.purpose) {
      case 'vat_credit':
        return {
          ...common,
          purpose: 'vat_credit',
          relatedActivityRevisionIds: this.execution.activities.map(
            (activity) => activity.revisionId,
          ),
          invoiceVatAmount: 0,
          potentialCreditableVatAmount: 0,
          creditablePercentage: 0,
          creditType: 'undetermined',
          proportionalityRequired: false,
          missingEvidence: [
            'Ejecución simulada: no se evaluó evidencia fiscal.',
          ],
        }
      case 'business_income_tax':
        return {
          ...common,
          purpose: 'business_income_tax',
          relatedActivityRevisionIds: this.execution.activities.map(
            (activity) => activity.revisionId,
          ),
          businessUsePercentage: 0,
          potentialExpenseAmount: 0,
          mixedUseDetected: false,
          substantiationIssues: [
            'Ejecución simulada: no se evaluó sustento fiscal.',
          ],
          missingEvidence: [
            'Ejecución simulada: no se evaluó evidencia fiscal.',
          ],
        }
      case 'personal_expenses':
        return {
          ...common,
          purpose: 'personal_expenses',
          personalExpenseCategory: 'Simulación',
          potentialEligibleAmount: 0,
          beneficiaryRelationship: 'No evaluado',
          missingEvidence: [
            'Ejecución simulada: no se evaluó evidencia fiscal.',
          ],
        }
    }
  }

  getCircuitBreakerStatus(): 'closed' {
    return 'closed'
  }

  resetCircuitBreaker(): void {}

  getTemperatureForPreset(preset: LLMPreset): number {
    return this.provider.getTemperatureForPreset(preset)
  }
}
