import { Agent, run, setTracingDisabled } from '@openai/agents'
import { OpenAIChatCompletionsModel } from '@openai/agents-openai'
import { DateTime } from 'luxon'
import OpenAI from 'openai'

import { ModelTaxAnalysisPayloadSchema } from '#/schema/tax-analysis'

import {
  AppError,
  CircuitBreaker,
  withRetry,
} from '#/integrations/errors/error-handler'
import { LMStudio } from '#/integrations/lm-studio'
import { getServiceLogger } from '#/integrations/logger.server'
import { createTelemetryService } from '#/integrations/services/telemetry.service'

import type { LLMPreset } from '#/config/llm-config'
import type { LLMProviderConfig } from '#/schema/llm-provider'
import type { ModelTaxAnalysisPayload } from '#/schema/tax-analysis'
import type { ContextProcess, ILLMProvider } from '../provider.interface'

import { env } from '#/env'

setTracingDisabled(true)

export class LMStudioProvider implements ILLMProvider {
  private circuitBreaker = new CircuitBreaker(5, 60_000)
  private telemetryService = createTelemetryService()
  private logger = getServiceLogger('LmStudioProvider')
  private agent: Agent | null = null
  private client: OpenAI

  constructor(private config: LLMProviderConfig) {
    const baseUrl = config.baseUrl
      ? `${config.baseUrl}:1234/v1`
      : 'http://localhost:1234/v1'
    this.logger.info('Initializing LMStudioProvider with config', {
      baseUrl,
      modelId: config.modelId,
    })
    this.client = new OpenAI({ baseURL: baseUrl, apiKey: 'dummy' })
  }

  getProviderName(): 'lm-studio' {
    return 'lm-studio'
  }

  getModelId(): string {
    return this.config.modelId
  }

  async isEngineHealthy(): Promise<boolean> {
    try {
      return await LMStudio.isEngineHealthy()
    } catch (error) {
      this.logger.error('Failed to check engine health', { error })
      return false
    }
  }

  async isModelLoaded(): Promise<boolean> {
    try {
      return await LMStudio.hasModelLoaded(this.config.modelId)
    } catch (error) {
      this.logger.error('Failed to check if model is loaded', { error })
      return false
    }
  }

  async loadModel(): Promise<void> {
    const response = await withRetry(
      () => LMStudio.loadModel({
        model: this.config.modelId,
        context_length: 8192,
        flash_attention: true,
      }),
      { maxRetries: 2, backoff: 'exponential' },
      `Load model ${this.config.modelId}`,
    )
    if (!response)
      throw new Error(`Failed to load model ${this.config.modelId}`)
  }

  async process(
    prompt: string,
    preset: LLMPreset,
    context?: ContextProcess,
  ): Promise<ModelTaxAnalysisPayload | null> {
    const startedAt = performance.now()
    let attempts = 0
    const temperature = this.getTemperatureForPreset(preset)

    try {
      if (env.FAKE_ANALYZE === 'true')
        throw new Error('FAKE_ANALYZE no produce resultados tributarios.')

      const response = await this.circuitBreaker.execute(async () => {
        attempts++
        const result = await run(this.getAgent(preset), prompt, {
          maxTurns: 6,
          stream: false,
        })
        const output =
          typeof result.finalOutput === 'string'
            ? JSON.parse(result.finalOutput)
            : result.finalOutput
        const validated = ModelTaxAnalysisPayloadSchema.safeParse(output)
        if (!validated.success)
          throw new Error('LMStudioProvider final output validation failed')
        return { data: validated.data, usage: result.state.usage }
      }, `LMStudioProvider.process (preset: ${preset})`)

      await this.recordTelemetry({
        context,
        preset,
        temperature,
        attempts,
        duration: Math.round(performance.now() - startedAt),
        tokensInput: response.usage.inputTokens,
        tokensOutput: response.usage.outputTokens,
        status: 'success',
      })
      return response.data
    } catch (error) {
      this.logger.error('LMStudioProvider failed to process analysis result', {
        error: error instanceof Error ? error.message : String(error),
      })
      await this.recordTelemetry({
        context,
        preset,
        temperature,
        attempts,
        duration: Math.round(performance.now() - startedAt),
        tokensInput: 0,
        tokensOutput: 0,
        status: error instanceof AppError ? 'circuit_open' : 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return null
    }
  }

  getTemperatureForPreset(preset: LLMPreset): number {
    if (preset === 'strict') return 0.35
    if (preset === 'balanced') return 0.65
    return 0.95
  }

  getCircuitBreakerStatus(): 'closed' | 'open' | 'half-open' {
    return this.circuitBreaker.getState()
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker.reset()
  }

  private getAgent(preset: LLMPreset): Agent {
    if (!this.agent)
      this.agent = new Agent({
        name: 'Bill Analysis Agent',
        model: new OpenAIChatCompletionsModel(this.client, this.config.modelId),
        instructions: this.config.agentInstructions,
        modelSettings: {
          temperature: this.getTemperatureForPreset(preset),
          maxTokens: this.config.maxTokens,
        },
      })
    return this.agent
  }

  private async recordTelemetry(input: {
    context?: ContextProcess
    preset: LLMPreset
    temperature: number
    attempts: number
    duration: number
    tokensInput: number
    tokensOutput: number
    status: 'success' | 'error' | 'circuit_open'
    error?: string
  }): Promise<void> {
    if (!input.context) return
    await this.telemetryService.recordAgentCall({
      jobId: input.context.jobId,
      billId: input.context.billId,
      tokensInput: input.tokensInput,
      tokensOutput: input.tokensOutput,
      tokensTotal: input.tokensInput + input.tokensOutput,
      model: this.config.modelId,
      preset: input.preset,
      temperature: input.temperature,
      duration: input.duration,
      attempts: input.attempts,
      status: input.status,
      error: input.error,
      promptVersion: input.context.promptVersion,
      timestamp: DateTime.now().toJSDate(),
    })
  }
}
