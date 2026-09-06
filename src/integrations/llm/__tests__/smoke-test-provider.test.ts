import { describe, expect, it, vi } from 'vitest'

import { ModelTaxAnalysisPayloadSchema } from '#/schema/tax-analysis'

import { LLMSmokeTestEnvSchema } from '../smoke-test-config'
import { SmokeTestProvider } from '../smoke-test-provider'

const ACTIVITY_ID = '11111111-1111-4111-8111-111111111111'

function realProvider() {
  return {
    getProviderName: vi.fn(() => 'openai' as const),
    getModelId: vi.fn(() => 'gpt-4o-mini'),
    isEngineHealthy: vi.fn(),
    isModelLoaded: vi.fn(),
    loadModel: vi.fn(),
    process: vi.fn(),
    getCircuitBreakerStatus: vi.fn(),
    resetCircuitBreaker: vi.fn(),
    getTemperatureForPreset: vi.fn(() => 0.5),
  }
}

describe('LLM smoke test configuration', () => {
  it('defaults off and accepts only explicit boolean strings', () => {
    expect(LLMSmokeTestEnvSchema.parse(undefined)).toBe(false)
    expect(LLMSmokeTestEnvSchema.parse('false')).toBe(false)
    expect(LLMSmokeTestEnvSchema.parse('true')).toBe(true)
    expect(() => LLMSmokeTestEnvSchema.parse('1')).toThrow()
    expect(() => LLMSmokeTestEnvSchema.parse('TRUE')).toThrow()
  })
})

describe('SmokeTestProvider', () => {
  it.each([
    ['vat_credit', [ACTIVITY_ID]],
    ['business_income_tax', [ACTIVITY_ID]],
    ['personal_expenses', []],
  ] as const)('returns a valid deterministic payload for %s without real-provider I/O', async (purpose, activityIds) => {
    const real = realProvider()
    const provider = new SmokeTestProvider(real, {
      context: { purpose },
      activities: activityIds.map((revisionId) => ({ revisionId })),
    } as any)

    await provider.isModelLoaded()
    await provider.loadModel()
    const payload = await provider.process('private prompt', 'balanced')

    expect(ModelTaxAnalysisPayloadSchema.parse(payload)).toEqual(payload)
    expect(real.isEngineHealthy).not.toHaveBeenCalled()
    expect(real.isModelLoaded).not.toHaveBeenCalled()
    expect(real.loadModel).not.toHaveBeenCalled()
    expect(real.process).not.toHaveBeenCalled()
  })
})
