import { describe, expect, it } from 'vitest'

import {
  CreateLocalConnectionSchema,
  resolveLocalAnalysisAvailability,
  type LocalConnection,
} from '../local-execution'

const connection: LocalConnection = {
  id: '1ee4824c-8fc4-42cf-8d02-e963a78d16d8',
  label: 'GPU casa',
  apiFlavor: 'openai-like',
  baseUrl: 'http://127.0.0.1:1234/v1',
  model: 'qwen-local',
  isDefault: true,
  lastProbedAt: null,
  lastProbeError: null,
  createdAt: new Date('2026-09-10T00:00:00.000Z'),
  updatedAt: new Date('2026-09-10T00:00:00.000Z'),
}

describe('local execution contracts', () => {
  it('accepts OpenAI-like and Claude-like connections without accepting a secret value', () => {
    const input = {
      label: 'GPU local',
      apiFlavor: 'claude-like',
      baseUrl: 'http://localhost:8080',
      model: 'claude-compatible-model',
      secretRef: 'keychain:bill-lm/gpu-local',
    }

    expect(CreateLocalConnectionSchema.parse(input)).toMatchObject(input)
    expect(
      CreateLocalConnectionSchema.safeParse({ ...input, apiKey: 'not-allowed' })
        .data,
    ).not.toHaveProperty('apiKey')
  })

  it('keeps Analyze available through provisional OAuth guidance without a connection', () => {
    expect(resolveLocalAnalysisAvailability([])).toEqual({
      kind: 'oauth-guidance',
      title: 'Continúa con OAuth',
      message: expect.any(String),
    })
  })

  it('selects the default or explicitly selected GPU connection', () => {
    expect(resolveLocalAnalysisAvailability([connection])).toEqual({
      kind: 'gpu-ready',
      connectionId: connection.id,
    })
    expect(
      resolveLocalAnalysisAvailability([connection], connection.id),
    ).toEqual({ kind: 'gpu-ready', connectionId: connection.id })
  })
})
