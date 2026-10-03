import { Agent, run, setTracingDisabled } from '@openai/agents'
import { OpenAIChatCompletionsModel } from '@openai/agents-openai'
import { DateTime } from 'luxon'
import { OpenAI } from 'openai'

import { ModelTaxAnalysisPayloadSchema } from '#/schema/tax-analysis'

import { AppError, CircuitBreaker } from '#/integrations/errors/error-handler'
import { getServiceLogger } from '#/integrations/logger.server'
import { createTelemetryService } from '#/integrations/services/telemetry.service'
import { TaxAnalysisAgentOutputType } from '#/integrations/llm/structured-analysis-output'

import type { LLMPreset } from '#/config/llm-config'
import type { LLMProviderConfig } from '#/schema/llm-provider'
import type { ModelTaxAnalysisPayload } from '#/schema/tax-analysis'
import type { ContextProcess, ILLMProvider } from '../provider.interface'

setTracingDisabled(true)

export class OpenAIProvider implements ILLMProvider {
  private circuitBreaker = new CircuitBreaker(5, 60_000)
  private telemetryService = createTelemetryService()
  private logger = getServiceLogger('OpenAiProvider')
  private agents = new Map<LLMPreset, Agent<unknown, typeof TaxAnalysisAgentOutputType>>()
  private client: OpenAI

  constructor(private config: LLMProviderConfig) {
    this.logger.info('Initializing OpenAIProvider with config', {
      modelId: config.modelId,
    })
    this.client = new OpenAI({
      organization: config.organization,
      project: config.projectId,
      apiKey: config.apiKey,
    })
  }

  getProviderName(): 'openai' {
    return 'openai'
  }

  getModelId(): string {
    return this.config.modelId
  }

  async isEngineHealthy(): Promise<boolean> {
    try {
      await this.client.models.retrieve(this.config.modelId)
      return true
    } catch (error) {
      this.logger.error('Failed to check OpenAI API health', { error })
      return false
    }
  }

  async isModelLoaded(): Promise<boolean> {
    return this.isEngineHealthy()
  }

  async loadModel(): Promise<void> {
    this.logger.debug('loadModel called for OpenAI - no-op (cloud API)')
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
        const result = await run(this.getAgent(preset), prompt, {
          maxTurns: 6,
          stream: false,
        })
        const output = result.finalOutput as { payload?: unknown } | undefined
        const validated = ModelTaxAnalysisPayloadSchema.safeParse(output?.payload)
        if (!validated.success)
          throw new Error('OpenAIProvider final output validation failed')
        return { data: validated.data, usage: result.state.usage }
      }, `OpenAIProvider.process (preset: ${preset})`)

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
      this.logger.error('OpenAIProvider failed to process analysis result', {
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

  private getAgent(preset: LLMPreset): Agent<unknown, typeof TaxAnalysisAgentOutputType> {
    const cached = this.agents.get(preset)
    if (cached) return cached

    const agent = new Agent({
      name: 'Bill Analysis Agent',
      model: new OpenAIChatCompletionsModel(this.client, this.config.modelId),
      instructions: this.config.agentInstructions,
      outputType: TaxAnalysisAgentOutputType,
      modelSettings: {
        temperature: this.getTemperatureForPreset(preset),
        maxTokens: this.config.maxTokens,
      },
    })
    this.agents.set(preset, agent)
    return agent
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
