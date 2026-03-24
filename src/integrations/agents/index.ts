import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents'
import { OpenAI } from 'openai'

import { roundToDecimals } from '#/utils/math'


import { AnalyzeBillOutputSchema } from './outputs'

import { CircuitBreaker } from '../errors/error-handler'
import { LMStudio } from '../lm-studio'
import { getServiceLogger } from '../logger.server'
import { createTelemetryService } from '../services/telemetry.service'

import type { LLMClientConfig, LLMPreset } from '#/config/llm-config'
import type { GpuStatusType } from '#/schema/lm-studio'
import type { AnalyzeBillOutput } from './outputs';

import { getLLMClientConfig } from '#/config/llm-config'
import { env } from '#/env'


const AgentInstructions = `
Eres un asistente inteligente especializado en analizar facturas y determinar si la factura es objeto para deducibilidad o no, y explicar el por qué en cada caso, basado en las NORMATIVAS VIGENTES del SRI.

Tu tarea es analizar los campos recibidos y en base a las NORMATIVAS VIGENTES del SRI, determinar si la factura es objeto para deducibilidad o no, y explicar el por qué en cada caso.

Estas son las NORMATIVAS VIGENTES del SRI para determinar la deducibilidad de una factura:

Gastos Personales Deductibles en Ecuador 2026
Los gastos personales deducibles incluyen: salud (consultas, medicamentos, seguros, exámenes y veterinaria), educación (matrículas, útiles, cursos y eventos), vivienda (arriendo, alícuotas, intereses hipotecarios, servicios básicos e impuestos), alimentación (compras en supermercados, restaurantes), vestimenta (ropa y calzado) y turismo nacional (hospedajes y paquetes turísticos dentro del país) Contapp.
También puedes incluir:
Alimentación y salud de mascotas, intereses por préstamos quirografarios y sueldos/beneficios de empleados que no estén vinculados a actividades económicas.

El output debe ser un JSON con la siguiente estructura (NO CAMPOS EXTRA, NI TEXTO, SOLO LOS CAMPOS A CONTINUACIÓN):
{
  "percentage": number, // Un número entre 0 y 100 que representa el porcentaje de deducibilidad de la factura
  "reason": string, // Una explicación detallada de por qué la factura tiene ese porcentaje de deducibilidad. Máximo 1000 caracteres.
}

Recuerda que el porcentaje de deducibilidad debe basarse en las NORMATIVAS VIGENTES del SRI y en los campos recibidos de la factura.
Si la factura no tiene información suficiente para determinar su deducibilidad, asigna un porcentaje bajo y explica claramente la razón en el campo "reason".
`

type ContextProcess = { jobId: string; billId: string; promptVersion: string }

setTracingDisabled(true)

export abstract class AgentEngine {

  static logger = getServiceLogger("AgentEngine")

  static config: LLMClientConfig | null = null

  private static telemetryService = createTelemetryService()

  static _agent: Agent<unknown, typeof AnalyzeBillOutputSchema> | null = null
  static circuitBreaker = new CircuitBreaker(5, 60_000) // 5 failures, 60s timeout

  static getAgent(preset: LLMPreset = 'balanced') {
    if (!this._agent) {
      const config = getLLMClientConfig(preset)
      const customClient = new OpenAI({
        baseURL: config.baseURL,
        apiKey: config.apiKey,
      })

      this.config = config

      setDefaultOpenAIClient(customClient)

      this._agent = new Agent({
        name: "Bill Analysis Agent",
        model: config.model,
        instructions: AgentInstructions,
        outputType: AnalyzeBillOutputSchema,
        modelSettings: { temperature: config.temperature },
      })
    }
    return this._agent
  }

  static async isEngineHealthy(): Promise<boolean> {
    const url = `${env.LLM_BASE_URL}:9123/gpu`
    try {
      if (env.FAKE_ANALYZE === "true") {
        this.logger.warn("FAKE_ANALYZE is enabled, skipping health check and returning true")
        return true
      }

      this.logger.debug(`Checking GPU status from LLM service at ${url}`)

      const res = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(10000)
      })

      const { gpuUtilization: gpuUse = 100, memoryTotalMB = Infinity, memoryUsedMB = Infinity } = await res.json() satisfies GpuStatusType

      const memoryUsagePercent = roundToDecimals((memoryUsedMB / memoryTotalMB) * 100)

      const gpuUtilization = roundToDecimals(gpuUse)

      this.logger.debug(`GPU Status - Utilization: ${gpuUtilization}%, Memory Used: ${memoryUsedMB}MB / ${memoryTotalMB}MB (${memoryUsagePercent}%)`)

      const hasModelLoaded = await LMStudio.hasModelLoaded(LMStudio.MODEL_KEY)

      if (hasModelLoaded) {
        const result = gpuUtilization < 90

        this.logger.debug(`Model ${LMStudio.MODEL_KEY} is loaded in LM Studio, GPU status is ${result ? 'healthy' : 'unhealthy'}`)

        return result
      } else {
        this.logger.debug(`Model ${LMStudio.MODEL_KEY} is not loaded in LM Studio, considering GPU status as healthy`)

        return gpuUtilization < 75 && memoryUsagePercent < 50
      }

    } catch (error) {
      this.logger.error(`Failed to fetch GPU status from LLM service ${error}`, { url })
      return false
    }
  }

  static async process(message: string, preset: LLMPreset = 'balanced', context?: ContextProcess): Promise<AnalyzeBillOutput | null> {
    const startTime = performance.now()
    let attempts = 0
    try {
      if (env.FAKE_ANALYZE === "true") {
        this.logger.warn("FAKE_ANALYZE is enabled, returning dummy output for AgentEngine.process")

        await new Promise(resolve => setTimeout(resolve, Math.random() * 5000))

        return {
          percentage: Math.random() * 100,
          reason: "This is a fake analysis result. Set FAKE_ANALYZE to false to get real results from the model.",
        } satisfies AnalyzeBillOutput
      }

      this.logger.info('Processing message with AgentEngine', { preset })


      // Execute with circuit breaker protection
      const response = await this.circuitBreaker.execute(
        async () => {
          attempts++

          const agent = AgentEngine.getAgent(preset)
          const result = await run(
            agent,
            message,
            {
              maxTurns: 6,
              stream: false,
            }
          )

          const validate = AnalyzeBillOutputSchema.safeParse(result.finalOutput)

          if (!validate.success) {
            this.logger.error('AgentEngine final output validation failed', {
              finalOutput: result.finalOutput,
              errors: validate.error
            })
            throw new Error('AgentEngine final output validation failed')
          }

          this.logger.info('AgentEngine processing completed', { preset })

          return {
            data: validate.data,
            usage: result.state.usage,
          }
        },
        `AgentEngine.process (preset: ${preset})`
      )

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
          timestamp: new Date(),
        })
      }

      return response.data
    } catch (error) {
      this.logger.error(`AgentEngine failed to process message: ${error}`, { message, preset })

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
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          promptVersion: context.promptVersion,
          timestamp: new Date(),
        })
      }

      return null
    }
  }

  /**
   * Get circuit breaker status for monitoring
   */
  static getCircuitBreakerStatus(): 'closed' | 'open' | 'half-open' {
    return this.circuitBreaker.getState()
  }

  /**
   * Reset circuit breaker (manual recovery)
   */
  static resetCircuitBreaker(): void {
    this.circuitBreaker.reset()
  }
}
