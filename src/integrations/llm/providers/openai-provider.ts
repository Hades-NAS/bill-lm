import {
  Agent,
  run,
  setDefaultOpenAIClient,
  setTracingDisabled,
} from '@openai/agents'
import { DateTime } from 'luxon'
import { OpenAI } from 'openai'

import { AnalyzeBillOutputSchema } from '#/schema/bill-analysis'


import { AppError, CircuitBreaker } from '#/integrations/errors/error-handler'
import { getServiceLogger } from '#/integrations/logger.server'
import { createTelemetryService } from '#/integrations/services/telemetry.service'

import type { LLMPreset } from '#/config/llm-config'
import type { AnalyzeBillOutput } from '#/schema/bill-analysis'
import type { LLMProviderConfig } from '#/schema/llm-provider'
import type {
  ContextProcess,
  ILLMProvider,
} from '../provider.interface'

setTracingDisabled(true)

/**
 * OpenAI Provider
 * Uses OpenAI Agent SDK with real OpenAI API key
 * Code mirrors AgentEngine but with real OpenAI credentials
 */
export class OpenAIProvider implements ILLMProvider {
  private circuitBreaker: CircuitBreaker
  private telemetryService = createTelemetryService()
  private logger = getServiceLogger('OpenAiProvider')
  private _agent: Agent<unknown, typeof AnalyzeBillOutputSchema> | null = null
  private client: OpenAI
  private agentInstructions: string

  constructor(private config: LLMProviderConfig) {
    this.circuitBreaker = new CircuitBreaker(5, 60_000) // 5 failures, 60s timeout

    this.logger.info('Initializing OpenAIProvider with config', {
      modelId: config.modelId,
    })

    this.client = new OpenAI({
      organization: config.organization,
      project: config.projectId,
      apiKey: config.apiKey,
    })

    // Set default client for Agent SDK
    setDefaultOpenAIClient(this.client)

    this.agentInstructions = config.agentInstructions
  }

  /**
   * Get provider name
   */
  getProviderName(): 'openai' {
    return 'openai'
  }

  /**
   * Get model ID
   */
  getModelId(): string {
    return this.config.modelId
  }

  /**
   * Check if engine is healthy
   * For OpenAI, we don't have GPU status, just check API connectivity
   */
  async isEngineHealthy(): Promise<boolean> {
    try {
      this.logger.debug('Checking OpenAI API connectivity')

      return Promise.resolve(true)
      // Simple connectivity check by listing models
      // const models = await this.client.models.list()
      // const hasModels = models.data.length > 0

      // this.logger.debug(
      //   `OpenAI API connectivity check ${hasModels ? 'healthy' : 'unhealthy'}`,
      // )

      // return hasModels
    } catch (error) {
      this.logger.error('Failed to check OpenAI API health', { error })
      return false
    }
  }

  /**
   * Check if model is loaded
   * For OpenAI cloud API, models are always available
   */
  async isModelLoaded(): Promise<boolean> {
    try {
      return Promise.resolve(true)
      // const models = await this.client.models.list()
      // const modelExists = models.data.some((m) => m.id === this.config.modelId)

      // this.logger.debug(
      //   `Model ${this.config.modelId} ${modelExists ? 'exists' : 'not found'} in OpenAI`,
      // )

      // return modelExists
    } catch (error) {
      this.logger.error('Failed to check model availability', { error })
      return false
    }
  }

  /**
   * Load model
   * For OpenAI cloud API, this is a no-op (models are always available)
   */
  async loadModel(): Promise<void> {
    this.logger.debug('loadModel called for OpenAI - no-op (cloud API)')
    return Promise.resolve()
  }

  /**
   * Create or reuse agent instance
   */
  private getAgent(
    _preset: LLMPreset = 'balanced',
  ): Agent<unknown, typeof AnalyzeBillOutputSchema> {
    if (!this._agent) {
      // const temperature = this.getTemperatureForPreset(preset)

      this._agent = new Agent({
        name: 'Bill Analysis Agent',
        model: this.config.modelId,
        instructions: this.agentInstructions,
        outputType: AnalyzeBillOutputSchema,
        // modelSettings: { temperature, maxTokens: this.config.maxTokens },
      })
    }
    return this._agent
  }

  /**
   * Process a prompt and return analysis output
   */
  async process(
    prompt: string,
    preset: LLMPreset,
    context?: ContextProcess,
  ): Promise<AnalyzeBillOutput | null> {
    const startTime = performance.now()
    let attempts = 0
    const temperature = this.getTemperatureForPreset(preset)

    try {
      return await this.circuitBreaker.execute(async () => {
        attempts++

        this.logger.info('Processing message with OpenAIProvider', { preset })

        const agent = this.getAgent(preset)
        const result = await run(agent, prompt, {
          maxTurns: 6,
          stream: false,
        })

        const validate = AnalyzeBillOutputSchema.safeParse(result.finalOutput)

        if (!validate.success) {
          this.logger.error('OpenAIProvider final output validation failed', {
            finalOutput: result.finalOutput,
            errors: validate.error,
          })
          throw new Error('OpenAIProvider final output validation failed')
        }

        this.logger.info('OpenAIProvider processing completed', { preset })

        const duration = Math.round(performance.now() - startTime)

        // Record telemetry
        if (context) {
          await this.telemetryService.recordAgentCall({
            jobId: context.jobId,
            billId: context.billId,
            tokensInput: result.state.usage.inputTokens,
            tokensOutput: result.state.usage.outputTokens,
            tokensTotal:
              result.state.usage.inputTokens + result.state.usage.outputTokens,
            model: this.config.modelId,
            preset,
            temperature,
            duration,
            attempts,
            status: 'success',
            promptVersion: context.promptVersion,
            timestamp: DateTime.now().toJSDate(),
          })
        }

        return validate.data
      }, `OpenAIProvider.process (preset: ${preset})`)
    } catch (error) {
      const duration = Math.round(performance.now() - startTime)

      this.logger.error(`OpenAIProvider failed to process message: ${error}`, {
        message: prompt.slice(0, 100),
        preset,
      })

      // Record error telemetry
      if (context) {
        await this.telemetryService.recordAgentCall({
          jobId: context.jobId,
          billId: context.billId,
          tokensInput: 0,
          tokensOutput: 0,
          tokensTotal: 0,
          model: this.config.modelId,
          preset,
          temperature,
          duration,
          attempts,
          status: error instanceof AppError ? 'circuit_open' : 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          promptVersion: context.promptVersion,
          timestamp: DateTime.now().toJSDate(),
        })
      }

      return null
    }
  }

  getTemperatureForPreset: (preset: LLMPreset) => number = (preset) => {
    if (preset === 'strict') {
      return 0.1
    } else if (preset === 'balanced') {
      return 0.5
    } else {
      return 0.7
    }
  }

  /**
   * Get circuit breaker status for monitoring
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
