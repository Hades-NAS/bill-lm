import {
  Agent,
  run,
  setTracingDisabled,
} from '@openai/agents'
import { OpenAIChatCompletionsModel } from '@openai/agents-openai'
import { DateTime } from 'luxon'
import { OpenAI } from 'openai'

import { AnalyzeBillOutputSchema } from '#/schema/bill-analysis'

import { AppError, CircuitBreaker } from '#/integrations/errors/error-handler'
import { getServiceLogger } from '#/integrations/logger.server'
import { createTelemetryService } from '#/integrations/services/telemetry.service'

import type { LLMClientConfig, LLMPreset } from '#/config/llm-config'
import type { AnalyzeBillOutput } from '#/schema/bill-analysis'

import { getLLMClientConfig } from '#/config/llm-config'
import { env } from '#/env'

type ContextProcess = { jobId: string; billId: string; promptVersion: string }

setTracingDisabled(true)

export abstract class AgentEngine {
  private logger = getServiceLogger('AgentEngine')

  private config: LLMClientConfig | null = null

  private telemetryService = createTelemetryService()

  private agent: Agent<unknown, typeof AnalyzeBillOutputSchema> | null = null
  private circuitBreaker = new CircuitBreaker(5, 60_000) // 5 failures, 60s timeout

  private getAgent(preset: LLMPreset = 'balanced') {
    if (!this.agent) {
      const config = getLLMClientConfig(preset)
      const customClient = new OpenAI({
        baseURL: config.baseURL,
        apiKey: config.apiKey,
      })

      this.config = config

      this.agent = new Agent({
        name: 'Bill Analysis Agent',
        model: new OpenAIChatCompletionsModel(customClient, config.model),
        instructions: 'dummy',
        outputType: AnalyzeBillOutputSchema,
        modelSettings: { temperature: config.temperature },
      })
    }
    return this.agent
  }

  // static async isEngineHealthy(): Promise<boolean> {
  //   const url = `${env.LLM_BASE_URL}:9123/gpu`
  //   try {
  //     if (env.FAKE_ANALYZE === "true") {
  //       this.logger.warn("FAKE_ANALYZE is enabled, skipping health check and returning true")
  //       return true
  //     }

  //     this.logger.debug(`Checking GPU status from LLM service at ${url}`)

  //     const res = await fetch(url, {
  //       method: "GET",
  //       signal: AbortSignal.timeout(10000)
  //     })

  //     const { gpuUtilization: gpuUse = 100, memoryTotalMB = Infinity, memoryUsedMB = Infinity } = await res.json() satisfies GpuStatusType

  //     const memoryUsagePercent = roundToDecimals((memoryUsedMB / memoryTotalMB) * 100)

  //     const gpuUtilization = roundToDecimals(gpuUse)

  //     this.logger.debug(`GPU Status - Utilization: ${gpuUtilization}%, Memory Used: ${memoryUsedMB}MB / ${memoryTotalMB}MB (${memoryUsagePercent}%)`)

  //     const hasModelLoaded = await LMStudio.hasModelLoaded(LMStudio.MODEL_KEY)

  //     if (hasModelLoaded) {
  //       const result = gpuUtilization < 90

  //       this.logger.debug(`Model ${LMStudio.MODEL_KEY} is loaded in LM Studio, GPU status is ${result ? 'healthy' : 'unhealthy'}`)

  //       return result
  //     } else {
  //       this.logger.debug(`Model ${LMStudio.MODEL_KEY} is not loaded in LM Studio, considering GPU status as healthy`)

  //       return gpuUtilization < 75 && memoryUsagePercent < 50
  //     }

  //   } catch (error) {
  //     this.logger.error(`Failed to fetch GPU status from LLM service ${error}`, { url })
  //     return false
  //   }
  // }

  async process(
    message: string,
    preset: LLMPreset = 'balanced',
    context?: ContextProcess,
  ): Promise<AnalyzeBillOutput | null> {
    const startTime = performance.now()
    let attempts = 0
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

      this.logger.info('Processing message with AgentEngine', { preset })

      // Execute with circuit breaker protection
      const response = await this.circuitBreaker.execute(async () => {
        attempts++

        const agent = this.getAgent(preset)
        const result = await run(agent, message, {
          maxTurns: 6,
          stream: false,
        })

        const validate = AnalyzeBillOutputSchema.safeParse(result.finalOutput)

        if (!validate.success) {
          this.logger.error('AgentEngine final output validation failed', {
            finalOutput: result.finalOutput,
            errors: validate.error,
          })
          throw new Error('AgentEngine final output validation failed')
        }

        this.logger.info('AgentEngine processing completed', { preset })

        return {
          data: validate.data,
          usage: result.state.usage,
        }
      }, `AgentEngine.process (preset: ${preset})`)

      const duration = performance.now() - startTime

      if (context) {
        await this.telemetryService.recordAgentCall({
          jobId: context.jobId,
          billId: context.billId,
          tokensInput: response.usage.inputTokens,
          tokensOutput: response.usage.outputTokens,
          tokensTotal: response.usage.inputTokens + response.usage.outputTokens,
          model: this.config?.model || 'unknown',
          preset,
          temperature: this.config?.temperature || 0,
          duration: Math.round(duration),
          attempts,
          status: 'success',
          promptVersion: context.promptVersion,
          timestamp: DateTime.now().toJSDate(),
        })
      }

      return response.data
    } catch (error) {
      this.logger.error(`AgentEngine failed to process message: ${error}`, {
        message,
        preset,
      })

      const duration = performance.now() - startTime

      if (context) {
        await this.telemetryService.recordAgentCall({
          jobId: context.jobId,
          billId: context.billId,
          tokensInput: 0,
          tokensOutput: 0,
          tokensTotal: 0,
          model: 'unknown',
          preset,
          temperature: 0,
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
