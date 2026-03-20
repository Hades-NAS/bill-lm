
import { getServiceLogger } from "../logger.server"



import type { LoadModelRequest, LoadModelResponse, ModelResponse, UnloadModelRequest, UnloadModelResponse } from "#/schema/lm-studio"

import { env } from "#/env"


export abstract class LMStudio {

  static logger = getServiceLogger("LMStudio")

  static readonly URL_BASE = `${env.LLM_BASE_URL}:1234/api/v1`

  static readonly MODEL_KEY = env.MODEL_KEY || "openai/gpt-oss-20b"

  static async listModels(): Promise<Array<ModelResponse>> {
    try {
      const url = `${this.URL_BASE}/models`
      this.logger.debug(`Fetching models from LM Studio at ${url}`)

      const res = await fetch(url, { method: "GET" })
      const data = await res.json() as { models?: Array<ModelResponse> }

      this.logger.debug('Received models from LM Studio', { models: data.models?.length ?? 0 })

      return data.models || []
    } catch (error) {
      this.logger.error(`Failed to list models from LM Studio: ${error}`)
      return []
    }
  }

  static async loadModel(request: LoadModelRequest): Promise<LoadModelResponse | null> {
    try {
      const url = `${this.URL_BASE}/models/load`
      this.logger.debug(`Loading model in LM Studio at ${url} with request`, { request })

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })

      const data = await res.json() as LoadModelResponse

      this.logger.debug('Received load model response from LM Studio', { response: data })

      return data
    } catch (error) {
      this.logger.error(`Failed to load model in LM Studio: ${error}`)
      return null
    }
  }

  static async unloadModel(request: UnloadModelRequest): Promise<UnloadModelResponse | null> {
    try {
      const url = `${this.URL_BASE}/models/unload`
      this.logger.debug(`Unloading model in LM Studio at ${url} with request`, { request })

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      })

      const data = await res.json() as UnloadModelResponse

      this.logger.debug('Received unload model response from LM Studio', { response: data })

      return data
    } catch (error) {
      this.logger.error(`Failed to unload model in LM Studio: ${error}`)
      return null
    }
  }

  static async hasModelLoaded(modelKey: string): Promise<boolean> {
    try {
      if (env.FAKE_ANALYZE === "true") {
        this.logger.warn("FAKE_ANALYZE is enabled, skipping model loaded check and returning true")
        return true
      }

      const models = await this.listModels()

      const model = models.find(m => m.key === modelKey)

      const hasInstancesLoaded = model?.loaded_instances.length ?? 0

      this.logger.debug(`Model ${modelKey} loaded in LM Studio ${hasInstancesLoaded} instances`)

      return hasInstancesLoaded > 0
    } catch (error) {
      this.logger.error(`Failed to check if model is loaded in LM Studio: ${error}`)
      return false
    }
  }
}
