import { getServiceLogger } from '#/integrations/logger.server'

import { roundToDecimals } from '#/utils/math'

import type {
  GpuStatusType,
  LoadModelRequest,
  LoadModelResponse,
  ModelResponse,
  UnloadModelRequest,
  UnloadModelResponse,
} from '#/schema/lm-studio'

import { env } from '#/env'

export abstract class LMStudio {
  static logger = getServiceLogger('LmStudio')

  static readonly URL_BASE = `${env.LLM_BASE_URL}:1234/api/v1`

  static readonly MODEL_KEY = env.MODEL_KEY || 'openai/gpt-oss-20b'

  static async listModels(): Promise<Array<ModelResponse>> {
    try {
      const url = `${this.URL_BASE}/models`
      this.logger.debug(`Fetching models from LM Studio at ${url}`)

      const res = await fetch(url, { method: 'GET' })
      const data = (await res.json()) as { models?: Array<ModelResponse> }

      this.logger.debug('Received models from LM Studio', {
        models: data.models?.length ?? 0,
      })

      return data.models || []
    } catch (error) {
      this.logger.error(`Failed to list models from LM Studio: ${error} `, {
        url: `${this.URL_BASE}/models`,
      })
      return []
    }
  }

  static async loadModel(
    request: LoadModelRequest,
  ): Promise<LoadModelResponse | null> {
    try {
      const url = `${this.URL_BASE}/models/load`
      this.logger.debug(`Loading model in LM Studio at ${url} with request`, {
        request,
      })

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      const data = (await res.json()) as LoadModelResponse

      this.logger.debug('Received load model response from LM Studio', {
        response: data,
      })

      return data
    } catch (error) {
      this.logger.error(`Failed to load model in LM Studio: ${error}`)
      return null
    }
  }

  static async unloadModel(
    request: UnloadModelRequest,
  ): Promise<UnloadModelResponse | null> {
    try {
      const url = `${this.URL_BASE}/models/unload`
      this.logger.debug(`Unloading model in LM Studio at ${url} with request`, {
        request,
      })

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      const data = (await res.json()) as UnloadModelResponse

      this.logger.debug('Received unload model response from LM Studio', {
        response: data,
      })

      return data
    } catch (error) {
      this.logger.error(`Failed to unload model in LM Studio: ${error}`)
      return null
    }
  }

  static async hasModelLoaded(modelKey: string): Promise<boolean> {
    try {
      if (env.FAKE_ANALYZE === 'true') {
        this.logger.warn(
          'FAKE_ANALYZE is enabled, skipping model loaded check and returning true',
        )
        return true
      }

      const models = await this.listModels()

      const model = models.find((m) => m.key === modelKey)

      const hasInstancesLoaded = model?.loaded_instances.length ?? 0

      this.logger.debug(
        `Model ${modelKey} loaded in LM Studio ${hasInstancesLoaded} instances`,
      )

      return hasInstancesLoaded > 0
    } catch (error) {
      this.logger.error(
        `Failed to check if model is loaded in LM Studio: ${error} `,
        { modelKey },
      )
      return false
    }
  }

  static async isEngineHealthy(): Promise<boolean> {
    const url = `${env.LLM_BASE_URL}:9123/gpu`
    try {
      if (env.FAKE_ANALYZE === 'true') {
        this.logger.warn(
          'FAKE_ANALYZE is enabled, skipping health check and returning true',
        )
        return true
      }

      this.logger.debug(`Checking GPU status from LLM service at ${url}`)

      const res = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      })

      const {
        gpuUtilization: gpuUse = 100,
        memoryTotalMB = Infinity,
        memoryUsedMB = Infinity,
      } = (await res.json()) satisfies GpuStatusType

      const memoryUsagePercent = roundToDecimals(
        (memoryUsedMB / memoryTotalMB) * 100,
      )

      const gpuUtilization = roundToDecimals(gpuUse)

      this.logger.debug(
        `GPU Status - Utilization: ${gpuUtilization}%, Memory Used: ${memoryUsedMB}MB / ${memoryTotalMB}MB (${memoryUsagePercent}%)`,
      )

      const hasModelLoaded = await this.hasModelLoaded(LMStudio.MODEL_KEY)

      if (hasModelLoaded) {
        const result = gpuUtilization < 90

        this.logger.debug(
          `Model ${LMStudio.MODEL_KEY} is loaded in LM Studio, GPU status is ${result ? 'healthy' : 'unhealthy'}`,
        )

        return result
      } else {
        this.logger.debug(
          `Model ${LMStudio.MODEL_KEY} is not loaded in LM Studio, considering GPU status as healthy`,
        )

        return gpuUtilization < 75 && memoryUsagePercent < 50
      }
    } catch (error) {
      this.logger.error(
        `Failed to fetch GPU status from LLM service ${error}`,
        { url },
      )
      return false
    }
  }
}
