import { ClaudeProvider } from './providers/claude-provider'
import { LMStudioProvider } from './providers/lm-studio-provider'
import { OpenAIProvider } from './providers/openai-provider'

import { createBillPromptBuilder } from '../prompts/bill-prompt-builder'

import type {
  ILLMProvider,
  LLMProviderConfig,
  LLMProviderType,
} from './provider.interface'
import type { env } from '@/env'

import { getServiceLogger } from '@/integrations/logger.server'

const logger = getServiceLogger('LlmProviderFactory')

/**
 * Factory for creating and managing LLM provider instances
 * Uses singleton pattern - call create() once at app startup
 */
export class LLMProviderFactory {
  private static instance: ILLMProvider | null = null

  private static promptBuilder = createBillPromptBuilder()

  /**
   * Factory method - instantiate the correct provider based on LLM_PROVIDER env var
   * Call this ONCE at application startup
   */
  static create(serverEnv: typeof env): ILLMProvider {
    if (this.instance) {
      logger.debug(
        'LLMProvider already initialized, returning existing instance',
      )
      return this.instance
    }

    const providerType = serverEnv.LLM_PROVIDER as LLMProviderType

    logger.info('Initializing LLMProvider', { provider: providerType })

    const baseConfig: LLMProviderConfig = {
      modelId: '',
      agentInstructions: this.promptBuilder.getAgentInstructions(),
      provider: providerType,
      maxTokens: parseInt(serverEnv.LLM_MAX_TOKENS ?? '2048'),
      timeout: parseInt(serverEnv.LLM_TIMEOUT_MS ?? '30000'),
    }

    switch (providerType) {
      case 'openai':
        logger.info('Creating OpenAI provider')
        if (!serverEnv.OPENAI_API_KEY) {
          throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER=openai')
        }
        this.instance = new OpenAIProvider({
          ...baseConfig,
          modelId: serverEnv.OPENAI_MODEL_ID ?? 'gpt-4o-mini',
          apiKey: serverEnv.OPENAI_API_KEY,
          projectId: serverEnv.OPENAI_PROJECT_ID,
          organization: serverEnv.OPENAI_ORGANIZATION,
        })
        break

      case 'claude':
        logger.info('Creating Claude provider')
        if (!serverEnv.CLAUDE_API_KEY) {
          throw new Error('CLAUDE_API_KEY is required when LLM_PROVIDER=claude')
        }
        this.instance = new ClaudeProvider({
          ...baseConfig,
          modelId: serverEnv.CLAUDE_MODEL_ID ?? 'claude-opus-4-6',
          apiKey: serverEnv.CLAUDE_API_KEY,
        })
        break

      case 'lm-studio':
      default:
        logger.info('Creating LM Studio provider')
        if (!serverEnv.LLM_BASE_URL) {
          throw new Error(
            'LLM_BASE_URL is required when LLM_PROVIDER=lm-studio',
          )
        }
        this.instance = new LMStudioProvider({
          ...baseConfig,
          modelId: serverEnv.MODEL_KEY ?? 'openai/gpt-oss-20b',
          baseUrl: serverEnv.LLM_BASE_URL,
        })
    }

    logger.info('LLMProvider initialized successfully', {
      provider: this.instance.getProviderName(),
      model: this.instance.getModelId(),
    })

    return this.instance
  }

  /**
   * Get the current provider instance
   * Must be called after create() has been called at startup
   */
  static getInstance(): ILLMProvider {
    if (!this.instance) {
      throw new Error(
        'LLMProvider not initialized. Call LLMProviderFactory.create(env) at application startup.',
      )
    }
    return this.instance
  }

  /**
   * Reset the provider (useful for testing)
   */
  static reset(): void {
    logger.debug('Resetting LLMProvider instance')
    this.instance = null
  }
}
