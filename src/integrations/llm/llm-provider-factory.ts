import { adminDb } from '#/integrations/firebase/firebase.server'

import { FireCollections } from '#/constants/firebase'

import { ClaudeProvider } from './providers/claude-provider'
import { LMStudioProvider } from './providers/lm-studio-provider'
import { OpenAIProvider } from './providers/openai-provider'

import { createBillPromptBuilder } from '../prompts/bill-prompt-builder'

import type { LLMProviderConfig, LLMProviderType } from '#/schema/llm-provider'
import type { ILLMProvider } from './provider.interface'
import type { env } from '@/env'

import { LLMProviderEnum } from '@/env'
import { getServiceLogger } from '@/integrations/logger.server'


const logger = getServiceLogger('LlmProviderFactory')

/**
 * Creates a provider for one analysis execution.
 *
 * It deliberately owns no static state: callers must create a new instance for
 * every job after resolving that job's credential. This prevents a later BYOK
 * credential from crossing a worker or user boundary.
 */
export class LLMProviderFactory {
  private promptBuilder = createBillPromptBuilder()

  /**
   * Instantiate an immutable provider for the supplied execution configuration.
   * `apiKey` is intentionally accepted only here, in server memory; it is not a
   * job, Firestore, telemetry, or browser contract.
   */
  create(config: LLMProviderConfig): ILLMProvider {
    const baseConfig: LLMProviderConfig = {
      ...config,
      agentInstructions:
        config.agentInstructions || this.promptBuilder.getAgentInstructions(),
    }

    logger.info('Creating LLM provider for execution', {
      provider: baseConfig.provider,
      model: baseConfig.modelId,
    })

    switch (baseConfig.provider) {
      case 'openai':
        if (!baseConfig.apiKey) {
          throw new Error('An OpenAI API key is required for this execution')
        }
        return new OpenAIProvider(baseConfig)

      case 'claude':
        if (!baseConfig.apiKey) {
          throw new Error('A Claude API key is required for this execution')
        }
        return new ClaudeProvider(baseConfig)

      case 'lm-studio':
      default:
        if (!baseConfig.baseUrl) {
          throw new Error(
            'An LM Studio base URL is required for this execution',
          )
        }
        return new LMStudioProvider(baseConfig)
    }
  }
}

async function getProviderFromFirebase(): Promise<LLMProviderType | null> {
  const snap = await adminDb
    .collection(FireCollections.CONFIG_COLLECTION)
    .doc('llm-provider-config')
    .get()

  if (!snap.exists) {
    return null
  }

  const result = LLMProviderEnum.safeParse(snap.data()?.provider)
  if (!result.success) {
    logger.warn('Ignoring invalid LLM provider configuration from Firebase')
    return null
  }

  return result.data
}

/**
 * Transitional server-only resolver for the existing environment credential.
 * BYOK replaces this in Phase 1 with a credentialId-owned resolver, but this
 * function still creates a fresh provider for every job today.
 */
export async function createEnvironmentLLMProvider(
  serverEnv: typeof env,
): Promise<ILLMProvider> {
  const provider = (await getProviderFromFirebase()) ?? serverEnv.LLM_PROVIDER
  const common = {
    provider,
    agentInstructions: createBillPromptBuilder().getAgentInstructions(),
    maxTokens: parseInt(serverEnv.LLM_MAX_TOKENS ?? '2048'),
    timeout: parseInt(serverEnv.LLM_TIMEOUT_MS ?? '30000'),
  }

  const config: LLMProviderConfig =
    provider === 'openai'
      ? {
          ...common,
          modelId: serverEnv.OPENAI_MODEL_ID ?? 'gpt-4o-mini',
          apiKey: serverEnv.OPENAI_API_KEY,
          projectId: serverEnv.OPENAI_PROJECT_ID,
          organization: serverEnv.OPENAI_ORGANIZATION,
        }
      : provider === 'claude'
        ? {
            ...common,
            modelId: serverEnv.CLAUDE_MODEL_ID ?? 'claude-opus-4-6',
            apiKey: serverEnv.CLAUDE_API_KEY,
          }
        : {
            ...common,
            modelId: serverEnv.MODEL_KEY ?? 'openai/gpt-oss-20b',
            baseUrl: serverEnv.LLM_BASE_URL,
          }

  return new LLMProviderFactory().create(config)
}
