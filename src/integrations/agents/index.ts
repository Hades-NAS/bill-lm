import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents'
import { OpenAI } from 'openai'

import { roundToDecimals } from '#/utils/math'

import { AnalyzeBillOutputSchema } from './outputs'


import { LMStudio } from '../lm-studio'
import { getServiceLogger } from '../logger.server'

import type { GpuStatusType } from '#/schema/lm-studio'
import type { AnalyzeBillOutput } from './outputs';

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

setTracingDisabled(true)

export abstract class AgentEngine {

  static logger = getServiceLogger("AgentEngine")

  static _agent: Agent<unknown, typeof AnalyzeBillOutputSchema> | null = null

  static getAgent() {
    if (!this._agent) {
      const customClient = new OpenAI({
        baseURL: `${env.LLM_BASE_URL}:1234/v1`,
        apiKey: 'dummy',
      })

      setDefaultOpenAIClient(customClient)

      this._agent = new Agent({
        name: "Budgetfy Email",
        model: 'openai/gpt-oss-20b',
        instructions: AgentInstructions,
        outputType: AnalyzeBillOutputSchema,
        modelSettings: { temperature: 0.1 },
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

  static async process(message: string): Promise<AnalyzeBillOutput | null> {
    try {
      if (env.FAKE_ANALYZE === "true") {
        this.logger.warn("FAKE_ANALYZE is enabled, returning dummy output for AgentEngine.process")

        await new Promise(resolve => setTimeout(resolve, Math.random() * 5000))

        return {
          percentage: Math.random() * 100,
          reason: "This is a fake analysis result. Set FAKE_ANALYZE to false to get real results from the model.",
        } satisfies AnalyzeBillOutput
      }

      this.logger.info('Processing message with AgentEngine')

      const agent = AgentEngine.getAgent()

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

      this.logger.info('AgentEngine processing completed')

      return validate.data
    } catch (error) {
      this.logger.error(`AgentEngine failed to process message: ${error}`, { message })
      return null
    }
  }
}
