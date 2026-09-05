import type { LLMPreset } from '@/config/llm-config'
import type { ModelTaxAnalysisPayload } from '@/schema/tax-analysis'

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
   * Process an immutable execution prompt. The model only owns the
   * purpose-specific payload; run and invoice metadata remain server-owned.
   */
  process: (
    prompt: string,
    preset: LLMPreset,
    context?: ContextProcess,
  ) => Promise<ModelTaxAnalysisPayload | null>

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
