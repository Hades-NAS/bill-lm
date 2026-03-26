import { Anthropic } from '@anthropic-ai/sdk'
import { DateTime } from 'luxon'

import { AnalyzeBillOutputSchema } from '#/schema/bill-analysis'

import { AppError, CircuitBreaker } from '#/integrations/errors/error-handler'
import { getServiceLogger } from '#/integrations/logger.server'
import { createTelemetryService } from '#/integrations/services/telemetry.service'

import type { LLMPreset } from '#/config/llm-config'
import type { AnalyzeBillOutput } from '#/schema/bill-analysis';
import type { ContextProcess, ILLMProvider, LLMProviderConfig } from '../provider.interface'

/**
 * Claude Provider
 * Uses Anthropic SDK directly with Messages API
 * Different from OpenAI/LMStudio which use Agent SDK
 */
export class ClaudeProvider implements ILLMProvider {
  private circuitBreaker: CircuitBreaker
  private telemetryService = createTelemetryService()
  private logger = getServiceLogger('ClaudeProvider')
  private client: Anthropic
  private agentInstructions: string

  constructor(private config: LLMProviderConfig) {
    this.circuitBreaker = new CircuitBreaker(5, 60_000) // 5 failures, 60s timeout

    this.logger.info('Initializing ClaudeProvider with config', {
      baseUrl: config.baseUrl,
      modelId: config.modelId,
    })

    // Initialize Anthropic client with API key
    this.client = new Anthropic({
      apiKey: config.apiKey,
    })
    this.agentInstructions = config.agentInstructions
  }

  /**
   * Get provider name
   */
  getProviderName(): 'claude' {
    return 'claude'
  }

  /**
   * Get model ID
   */
  getModelId(): string {
    return this.config.modelId
  }

  /**
   * Check if engine is healthy
   * For Claude, we check basic API connectivity
   */
  async isEngineHealthy(): Promise<boolean> {
    try {
      this.logger.debug('Checking Anthropic API connectivity')

      // Send a simple test message with minimal tokens
      const response = await this.client.messages.create({
        model: this.config.modelId,
        max_tokens: 10,
        system: 'You are a helpful assistant.',
        messages: [
          {
            role: 'user',
            content: 'ping',
          },
        ],
      })

      const isHealthy = response.stop_reason === 'end_turn'

      this.logger.debug(`Anthropic API connectivity check ${isHealthy ? 'healthy' : 'unhealthy'}`)

      return isHealthy
    } catch (error) {
      this.logger.error('Failed to check Anthropic API health', { error })
      return false
    }
  }

  /**
   * Check if model is loaded
   * For Claude cloud API, models are always available
   */
  async isModelLoaded(): Promise<boolean> {
    // For cloud APIs, models are always available
    this.logger.debug(`Model ${this.config.modelId} is always available in Claude API`)
    return Promise.resolve(true)
  }

  /**
   * Load model
   * For Claude cloud API, this is a no-op (models are always available)
   */
  async loadModel(): Promise<void> {
    this.logger.debug('loadModel called for Claude - no-op (cloud API)')
    return Promise.resolve()
  }

  /**
   * Process a prompt and return analysis output
   * Uses Anthropic Messages API directly
   */
  async process(
    prompt: string,
    preset: LLMPreset,
    context?: ContextProcess
  ): Promise<AnalyzeBillOutput | null> {
    const startTime = performance.now()
    let attempts = 0

    const temperature = this.getTemperatureForPreset(preset)

    try {
      return await this.circuitBreaker.execute(
        async () => {
          attempts++

          this.logger.info('Processing message with ClaudeProvider', { preset })

          const response = await this.client.messages.create({
            model: this.config.modelId,
            max_tokens: this.config.maxTokens,
            temperature,
            output_config: {
              format: {
                schema: {
                  percentage: { type: 'number' },
                  reason: { type: 'string' },
                },
                type: 'json_schema'
              }
            },
            system: this.agentInstructions,
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
          })

          // Extract text from response
          const textBlock = response.content.find((block) => block.type === 'text')
          if (!textBlock) {
            throw new Error('No text content in Claude response')
          }

          const text = textBlock.text

          // Parse JSON and validate
          const parsed = JSON.parse(text)
          const validate = AnalyzeBillOutputSchema.safeParse(parsed)

          if (!validate.success) {
            this.logger.error('ClaudeProvider output validation failed', {
              text: text.slice(0, 500),
              errors: validate.error,
            })
            throw new Error('ClaudeProvider output validation failed')
          }

          this.logger.info('ClaudeProvider processing completed', { preset })

          const duration = Math.round(performance.now() - startTime)

          // Record telemetry
          if (context) {
            await this.telemetryService.recordAgentCall({
              jobId: context.jobId,
              billId: context.billId,
              tokensInput: response.usage.input_tokens,
              tokensOutput: response.usage.output_tokens,
              tokensTotal: response.usage.input_tokens + response.usage.output_tokens,
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
        },
        `ClaudeProvider.process (preset: ${preset})`
      )
    } catch (error) {
      const duration = Math.round(performance.now() - startTime)

      this.logger.error(`ClaudeProvider failed to process message: ${error}`, {
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

  getTemperatureForPreset(preset: LLMPreset): number {
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
