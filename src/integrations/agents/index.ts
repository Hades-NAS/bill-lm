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
TEST
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
        modelSettings: { temperature: 0.3, frequencyPenalty: 0.4 },
      })
    }
    return this._agent
  }

  static async isEngineHealthy(): Promise<boolean> {
    try {
      if (env.FAKE_ANALYZE === "true") {
        this.logger.warn("FAKE_ANALYZE is enabled, skipping health check and returning true")
        return true
      }

      const url = `${env.LLM_BASE_URL}:9123/gpu`
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
      this.logger.error(`Failed to fetch GPU status from LLM service ${error}`)
      return false
    }
  }

  static async process(message: string) {
    try {
      if (env.FAKE_ANALYZE === "true") {
        this.logger.warn("FAKE_ANALYZE is enabled, returning dummy output for AgentEngine.process")

        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000))

        return {
          output: {
            percentage: Math.random() * 100,
            reason: "This is a fake analysis result. Set FAKE_ANALYZE to false to get real results from the model.",
          } satisfies AnalyzeBillOutput,
          history: [message],
        }
      }

      this.logger.info('Processing message with AgentEngine')

      const agent = AgentEngine.getAgent()

      const result = await run(
        agent,
        message,
        {
          maxTurns: 12,
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

      this.logger.info('AgentEngine processing completed', { output: validate.data, })

      return {
        output: validate.data,
        history: result.history,
      }
    } catch (error) {
      this.logger.error(`AgentEngine failed to process message: ${error}`, { message })
      return {
        output: null,
        history: [],
      }
    }
  }
}
