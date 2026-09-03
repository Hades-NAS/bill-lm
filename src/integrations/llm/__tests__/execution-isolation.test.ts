import { describe, expect, it } from 'vitest'

import { LLMProviderFactory } from '../llm-provider-factory'

import type { LLMProviderConfig } from '#/schema/llm-provider'

const baseConfig: Omit<LLMProviderConfig, 'apiKey'> = {
  provider: 'openai',
  modelId: 'gpt-4o-mini',
  maxTokens: 128,
  timeout: 1_000,
  agentInstructions: 'Return the invoice analysis.',
}

describe('LLMProviderFactory execution isolation', () => {
  it('creates independent OpenAI providers concurrently without a shared client', async () => {
    const [first, second] = await Promise.all([
      Promise.resolve(
        new LLMProviderFactory().create({
          ...baseConfig,
          apiKey: 'sk-phase-zero-user-one',
        }),
      ),
      Promise.resolve(
        new LLMProviderFactory().create({
          ...baseConfig,
          apiKey: 'sk-phase-zero-user-two',
        }),
      ),
    ])

    const firstConfig = (first as unknown as { config: LLMProviderConfig }).config
    const secondConfig = (second as unknown as { config: LLMProviderConfig }).config
    const firstClient = (first as unknown as { client: unknown }).client
    const secondClient = (second as unknown as { client: unknown }).client

    expect(first).not.toBe(second)
    expect(firstConfig).not.toBe(secondConfig)
    expect(firstClient).not.toBe(secondClient)
    expect(firstConfig.apiKey).toBe('sk-phase-zero-user-one')
    expect(secondConfig.apiKey).toBe('sk-phase-zero-user-two')
  })
})
