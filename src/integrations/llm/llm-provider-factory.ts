
import { adminDb } from '#/integrations/firebase/firebase.server'

import { FireCollections } from '#/constants/firebase'

import { ClaudeProvider } from './providers/claude-provider'
import { LMStudioProvider } from './providers/lm-studio-provider'
import { OpenAIProvider } from './providers/openai-provider'

import { createBillPromptBuilder } from '../prompts/bill-prompt-builder'

import type { LLMProviderConfig, LLMProviderType } from '#/schema/llm-provider'
import type {
  ILLMProvider,
} from './provider.interface'
import type { env } from '@/env';

import { LLMProviderEnum } from '@/env'
import { getServiceLogger } from '@/integrations/logger.server'

const logger = getServiceLogger('LlmProviderFactory')

/**
 * Factory for creating and managing LLM provider instances
 * Uses singleton pattern - call create() once at app startup
 */
export class LLMProviderFactory {
  private static instance: ILLMProvider | null = null

  private static llmProviderDocId = 'llm-provider-config'

  private static currentProvider: LLMProviderType | null = null

  private static promptBuilder = createBillPromptBuilder()

  /**
   * Factory method - instantiate the correct provider based on LLM_PROVIDER env var
   * Call this ONCE at application startup
   */
  static async create(serverEnv: typeof env): Promise<ILLMProvider> {
    if (this.instance) {
      logger.debug(
        'LLMProvider already initialized, returning existing instance',
      )
      return this.instance
    }

    this.currentProvider = (await this.getProviderFromFirebase()) ?? serverEnv.LLM_PROVIDER

    logger.info('Initializing LLMProvider', { provider: this.currentProvider })

    const baseConfig: LLMProviderConfig = {
      modelId: '',
      agentInstructions: this.promptBuilder.getAgentInstructions(),
      provider: this.currentProvider,
      maxTokens: parseInt(serverEnv.LLM_MAX_TOKENS ?? '2048'),
      timeout: parseInt(serverEnv.LLM_TIMEOUT_MS ?? '30000'),
    }

    switch (this.currentProvider) {
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

  static async getProviderFromFirebase() {
    logger.info('Fetching LLM provider config from Firebase')

    const snap = await adminDb.collection(FireCollections.CONFIG_COLLECTION).doc(this.llmProviderDocId).get()

    if (!snap.exists) {
      logger.warn('No LLM provider config found in Firebase, using default')
      return null
    }

    const data = snap.data() as Pick<LLMProviderConfig, 'provider'>

    logger.info('LLM provider config fetched from Firebase', { provider: data.provider })

    const result = LLMProviderEnum.safeParse(data.provider)
    if (!result.success) {
      logger.error('Invalid LLM provider config in Firebase, using default', { provider: data.provider })
      return null
    }

    return result.data
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
