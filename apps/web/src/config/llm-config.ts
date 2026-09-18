import { env } from '#/env'

export type LLMPreset = 'strict' | 'balanced' | 'creative'

export interface LLMPresetConfig {
  temperature: number
  // maxTokens: number
  description: string
}

export interface LLMConfig {
  model: string
  baseUrl: string
  temperature: number
  // maxTokens: number
  timeout: number
  presets: Record<LLMPreset, LLMPresetConfig>
}

export interface LLMClientConfig {
  baseURL: string
  apiKey: string
  model: string
  temperature: number
  // maxTokens: number
  timeout: number
}

/**
 * Centralized LLM configuration
 * Can be overridden via environment variables
 *
 * Presets:
 * - strict: Low temperature (0.1) for deterministic analysis, fewer tokens
 * - balanced: Medium temperature (0.5) for general analysis, standard tokens
 * - creative: Higher temperature (0.8) for exploratory analysis, more tokens
 */
export const LLMConfig: LLMConfig = {
  model: env.MODEL_KEY || 'openai/gpt-oss-20b',
  baseUrl: env.LLM_BASE_URL || 'http://localhost',
  temperature: parseFloat('0.1'),
  // maxTokens: parseInt(env.LLM_MAX_TOKENS || '2048'),
  timeout: parseInt(env.LLM_TIMEOUT_MS || '30000'),

  presets: {
    strict: {
      temperature: 0.1,
      // maxTokens: 1024,
      description: 'Low temperature for deterministic, critical analysis',
    },
    balanced: {
      temperature: 0.4,
      // maxTokens: 2048,
      description: 'Medium temperature for balanced analysis',
    },
    creative: {
      temperature: 0.7,
      // maxTokens: 4096,
      description: 'Higher temperature for exploratory analysis',
    },
  },
}

/**
 * Get preset configuration by name
 * @param preset - The preset name (default: 'balanced')
 * @returns The preset configuration
 */
export function getPresetConfig(
  preset: LLMPreset = 'balanced',
): LLMPresetConfig {
  return LLMConfig.presets[preset]
}

/**
 * Create a configuration for OpenAI client with preset
 * @param preset - The preset name
 * @returns Configuration object for OpenAI client
 */
export function getLLMClientConfig(
  preset: LLMPreset = 'balanced',
): LLMClientConfig {
  const presetConfig = getPresetConfig(preset)
  return {
    baseURL: `${LLMConfig.baseUrl}:1234/v1`,
    apiKey: 'dummy',
    model: LLMConfig.model,
    temperature: presetConfig.temperature,
    // maxTokens: presetConfig.maxTokens,
    timeout: LLMConfig.timeout,
  }
}
