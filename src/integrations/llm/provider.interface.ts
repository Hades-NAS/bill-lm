import type { LLMPreset } from '@/config/llm-config'
import type { AnalyzeBillOutput } from '@/schema/bill-analysis'
import type { ModelTaxAnalysisPayloadV2 } from '@/schema/tax-analysis-v2'

export interface ContextProcess {
  jobId: string
  billId: string
  promptVersion: string
}

export interface ILLMProvider {
  /**
   * Get the name of this provider
   */
  getProviderName: () => 'openai' | 'claude' | 'lm-studio'

  /**
   * Get the model ID being used
   */
  getModelId: () => string

  /**
   * Check if the LLM service is healthy (especially important for local LMStudio)
   */
  isEngineHealthy: () => Promise<boolean>

  /**
   * Check if the model is loaded (only relevant for LMStudio local)
   */
  isModelLoaded: () => Promise<boolean>

  /**
   * Load the model (noop for cloud providers like OpenAI/Claude)
   */
  loadModel: () => Promise<void>

  /**
   * Process a prompt and return analysis output
   * All providers return the same schema: AnalyzeBillOutput
   */
  process: (
    prompt: string,
    preset: LLMPreset,
    context?: ContextProcess,
  ) => Promise<AnalyzeBillOutput | null>

  /**
   * Process an immutable V2 execution prompt. The model only owns the
   * purpose-specific payload; run and invoice metadata remain server-owned.
   */
  processV2: (
    prompt: string,
    preset: LLMPreset,
    context?: ContextProcess,
  ) => Promise<ModelTaxAnalysisPayloadV2 | null>

  /**
   * Get the current state of the internal circuit breaker
   */
  getCircuitBreakerStatus: () => 'closed' | 'open' | 'half-open'

  /**
   * Reset the circuit breaker (useful for testing)
   */
  resetCircuitBreaker: () => void

  getTemperatureForPreset: (preset: LLMPreset) => number
}
