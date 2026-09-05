import { Agent, run, setTracingDisabled } from '@openai/agents'
import { OpenAIChatCompletionsModel } from '@openai/agents-openai'
import { DateTime } from 'luxon'
import OpenAI from 'openai'

import { AnalyzeBillOutputSchema } from '#/schema/bill-analysis'
import { ModelTaxAnalysisPayloadV2Schema } from '#/schema/tax-analysis-v2'

import {
  AppError,
  CircuitBreaker,
  withRetry,
} from '#/integrations/errors/error-handler'
import { LMStudio } from '#/integrations/lm-studio'
import { getServiceLogger } from '#/integrations/logger.server'
import { createTelemetryService } from '#/integrations/services/telemetry.service'

import type { LLMPreset } from '#/config/llm-config'
import type { AnalyzeBillOutput } from '#/schema/bill-analysis'
import type { LLMProviderConfig } from '#/schema/llm-provider'
import type { ModelTaxAnalysisPayloadV2 } from '#/schema/tax-analysis-v2'
import type { ContextProcess, ILLMProvider } from '../provider.interface'

import { env } from '#/env'

setTracingDisabled(true)

/**
 * LM Studio Provider
 * Wraps the existing AgentEngine which uses OpenAI SDK with LM Studio baseURL
 * Provides health checks, model loading, and circuit breaker protection
 */
export class LMStudioProvider implements ILLMProvider {
  private circuitBreaker: CircuitBreaker
  private telemetryService = createTelemetryService()
  private logger = getServiceLogger('LmStudioProvider')
  private _agent: Agent<unknown, typeof AnalyzeBillOutputSchema> | null = null
  private _v2Agent: Agent | null = null
  private client: OpenAI
  private agentInstructions: string

  constructor(private config: LLMProviderConfig) {
    this.circuitBreaker = new CircuitBreaker(5, 60_000) // 5 failures, 60s timeout

    const baseUrl = config.baseUrl
      ? `${config.baseUrl}:1234/v1`
      : 'http://localhost:1234/v1'

    this.logger.info('Initializing LMStudioProvider with config', {
      baseUrl,
      modelId: config.modelId,
    })

    this.client = new OpenAI({
      baseURL: baseUrl,
      apiKey: 'dummy',
    })

    this.agentInstructions = config.agentInstructions
  }

  /**
   * Get provider name
   */
  getProviderName(): 'lm-studio' {
    return 'lm-studio'
  }

  /**
   * Get model ID
   */
  getModelId(): string {
    return this.config.modelId
  }

  /**
   * Check if LM Studio engine is healthy
   * Delegates to AgentEngine which checks GPU status and memory
   */
  async isEngineHealthy(): Promise<boolean> {
    try {
      return await LMStudio.isEngineHealthy()
    } catch (error) {
      this.logger.error('Failed to check engine health', { error })
      return false
    }
  }

  /**
   * Check if model is loaded in LM Studio
   */
  async isModelLoaded(): Promise<boolean> {
    try {
      return await LMStudio.hasModelLoaded(this.config.modelId)
    } catch (error) {
      this.logger.error('Failed to check if model is loaded', { error })
      return false
    }
  }

  /**
   * Load model in LM Studio with retry logic
   */
  async loadModel(): Promise<void> {
    try {
      this.logger.info(`Loading model ${this.config.modelId} in LM Studio`)

      const response = await withRetry(
        () =>
          LMStudio.loadModel({
            model: this.config.modelId,
            context_length: 8192,
            flash_attention: true,
          }),
        { maxRetries: 2, backoff: 'exponential' },
        `Load model ${this.config.modelId}`,
      )

      if (!response) {
        throw new Error(`Failed to load model ${this.config.modelId}`)
      }

      this.logger.info(`Model ${this.config.modelId} loaded successfully`)
    } catch (error) {
      this.logger.error('Failed to load model', {
        error,
        model: this.config.modelId,
      })
      throw error
    }
  }

  /**
   * Process a prompt and return analysis output
   * Delegates to AgentEngine internally
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
      if (env.FAKE_ANALYZE === 'true') {
        this.logger.warn(
          'FAKE_ANALYZE is enabled, returning dummy output for AgentEngine.process',
        )

        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 5000),
        )

        return {
          percentage: Math.random() * 100,
          reason:
            'This is a fake analysis result. Set FAKE_ANALYZE to false to get real results from the model.',
        } satisfies AnalyzeBillOutput
      }

      this.logger.info('Processing message with LMStudioProvider', { preset })

      // Execute with circuit breaker protection
      const response = await this.circuitBreaker.execute(async () => {
        attempts++

        const agent = this.getAgent(preset)
        const result = await run(agent, prompt, {
          maxTurns: 6,
          stream: false,
        })

        const validate = AnalyzeBillOutputSchema.safeParse(result.finalOutput)

        if (!validate.success) {
          this.logger.error('LMStudioProvider final output validation failed', {
            finalOutput: result.finalOutput,
            errors: validate.error,
          })
          throw new Error('LMStudioProvider final output validation failed')
        }

        this.logger.info('LMStudioProvider processing completed', { preset })

        return {
          data: validate.data,
          usage: result.state.usage,
        }
      }, `LMStudioProvider.process (preset: ${preset})`)

      const duration = performance.now() - startTime

      if (context) {
        await this.telemetryService.recordAgentCall({
          jobId: context.jobId,
          billId: context.billId,
          tokensInput: response.usage.inputTokens,
          tokensOutput: response.usage.outputTokens,
          tokensTotal: response.usage.inputTokens + response.usage.outputTokens,
          model: this.config.modelId || 'unknown',
          preset,
          temperature,
          duration: Math.round(duration),
          attempts,
          status: 'success',
          promptVersion: context.promptVersion,
          timestamp: DateTime.now().toJSDate(),
        })
      }

      return response.data
    } catch (error) {
      const duration = Math.round(performance.now() - startTime)

      this.logger.error(
        `LMStudioProvider failed to process message: ${error}`,
        {
          message: prompt.slice(0, 100),
          preset,
        },
      )

      if (context) {
        await this.telemetryService.recordAgentCall({
          jobId: context.jobId,
          billId: context.billId,
          tokensInput: 0,
          tokensOutput: 0,
          tokensTotal: 0,
          model: 'unknown',
          preset,
          temperature,
          duration: Math.round(duration),
          attempts,
          status: error instanceof AppError ? 'circuit_open' : 'error',
          error: (error as Error).message || 'Unknown error',
          promptVersion: context.promptVersion,
          timestamp: DateTime.now().toJSDate(),
        })
      }

      return null
    }
  }

  async processV2(
    prompt: string,
    preset: LLMPreset,
    _context?: ContextProcess,
  ): Promise<ModelTaxAnalysisPayloadV2 | null> {
    try {
      if (env.FAKE_ANALYZE === 'true')
        throw new Error('FAKE_ANALYZE no produce resultados tributarios V2.')
      return await this.circuitBreaker.execute(async () => {
        const result = await run(this.getV2Agent(preset), prompt, {
          maxTurns: 6,
          stream: false,
        })
        const output =
          typeof result.finalOutput === 'string'
            ? JSON.parse(result.finalOutput)
            : result.finalOutput
        const validate = ModelTaxAnalysisPayloadV2Schema.safeParse(output)
        if (!validate.success)
          throw new Error('LMStudioProvider V2 final output validation failed')
        return validate.data
      }, `LMStudioProvider.processV2 (preset: ${preset})`)
    } catch (error) {
      this.logger.error('LMStudioProvider failed to process V2 result', {
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  private getAgent(
    preset: LLMPreset = 'balanced',
  ): Agent<unknown, typeof AnalyzeBillOutputSchema> {
    if (!this._agent) {
      const temperature = this.getTemperatureForPreset(preset)

      this._agent = new Agent({
        name: 'Bill Analysis Agent',
        model: new OpenAIChatCompletionsModel(this.client, this.config.modelId),
        instructions: this.agentInstructions,
        outputType: AnalyzeBillOutputSchema,
        modelSettings: { temperature, maxTokens: this.config.maxTokens },
      })
    }
    return this._agent
  }

  private getV2Agent(
    preset: LLMPreset = 'balanced',
  ): Agent {
    if (!this._v2Agent)
      this._v2Agent = new Agent({
        name: 'Bill Analysis V2 Agent',
        model: new OpenAIChatCompletionsModel(this.client, this.config.modelId),
        instructions: this.agentInstructions,
        modelSettings: {
          temperature: this.getTemperatureForPreset(preset),
          maxTokens: this.config.maxTokens,
        },
      })
    return this._v2Agent
  }

  getTemperatureForPreset(preset: LLMPreset): number {
    if (preset === 'strict') {
      return 0.35
    } else if (preset === 'balanced') {
      return 0.65
    } else {
      return 0.95
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
