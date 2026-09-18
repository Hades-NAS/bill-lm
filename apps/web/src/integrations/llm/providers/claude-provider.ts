import { Anthropic } from '@anthropic-ai/sdk'
import { DateTime } from 'luxon'

import { ModelTaxAnalysisPayloadSchema } from '#/schema/tax-analysis'

import { AppError, CircuitBreaker } from '#/integrations/errors/error-handler'
import { getServiceLogger } from '#/integrations/logger.server'
import { createTelemetryService } from '#/integrations/services/telemetry.service'

import type { LLMPreset } from '#/config/llm-config'
import type { LLMProviderConfig } from '#/schema/llm-provider'
import type { ModelTaxAnalysisPayload } from '#/schema/tax-analysis'
import type { ContextProcess, ILLMProvider } from '../provider.interface'

export class ClaudeProvider implements ILLMProvider {
  private circuitBreaker = new CircuitBreaker(5, 60_000)
  private telemetryService = createTelemetryService()
  private logger = getServiceLogger('ClaudeProvider')
  private client: Anthropic

  constructor(private config: LLMProviderConfig) {
    this.logger.info('Initializing ClaudeProvider with config', {
      modelId: config.modelId,
    })
    this.client = new Anthropic({ apiKey: config.apiKey })
  }

  getProviderName(): 'claude' {
    return 'claude'
  }

  getModelId(): string {
    return this.config.modelId
  }

  async isEngineHealthy(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: this.config.modelId,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      })
      return true
    } catch (error) {
      this.logger.error('Failed to check Anthropic API health', { error })
      return false
    }
  }

  async isModelLoaded(): Promise<boolean> {
    return true
  }

  async loadModel(): Promise<void> {
    this.logger.debug('loadModel called for Claude - no-op (cloud API)')
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
      const response = await this.circuitBreaker.execute(async () => {
        attempts++
        const result = await this.client.messages.create({
          model: this.config.modelId,
          max_tokens: this.config.maxTokens,
          temperature,
          system: this.config.agentInstructions,
          messages: [{ role: 'user', content: prompt }],
        })
        const text = result.content.find((block) => block.type === 'text')
        if (!text) throw new Error('No text content in Claude response')
        const validated = ModelTaxAnalysisPayloadSchema.safeParse(
          JSON.parse(text.text),
        )
        if (!validated.success)
          throw new Error('ClaudeProvider final output validation failed')
        return { data: validated.data, usage: result.usage }
      }, `ClaudeProvider.process (preset: ${preset})`)

      await this.recordTelemetry({
        context,
        preset,
        temperature,
        attempts,
        duration: Math.round(performance.now() - startedAt),
        tokensInput: response.usage.input_tokens,
        tokensOutput: response.usage.output_tokens,
        status: 'success',
      })
      return response.data
    } catch (error) {
      this.logger.error('ClaudeProvider failed to process analysis result', {
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
    if (preset === 'strict') return 0.1
    if (preset === 'balanced') return 0.5
    return 0.7
  }

  getCircuitBreakerStatus(): 'closed' | 'open' | 'half-open' {
    return this.circuitBreaker.getState()
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker.reset()
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
