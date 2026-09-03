import { describe, expect, it } from 'vitest'

import { sanitizeLogValue } from '#/integrations/logger.server'
import { AgentTelemetrySchema } from '../telemetry'
import {
  AnalyzeJobDataSchema,
  AnalyzeJobNotificationSchema,
} from '../collections'

const apiKey = 'sk-phase-zero-must-not-leak'

function expectSecretFree(value: unknown) {
  expect(JSON.stringify(value)).not.toContain(apiKey)
}

describe('BYOK secret boundary contracts', () => {
  it('strips an injected key from BullMQ and Firestore job payloads', () => {
    const job = AnalyzeJobDataSchema.parse({
      jobId: 'job-1',
      userId: 'user-1',
      credentialId: 'credential-1',
      apiKey,
      data: {
        collectionId: 'collection-1',
        collectionName: 'Facturas',
        billIds: ['bill-1'],
        type: 'all',
        apiKey,
      },
      percentage: 0,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      totalTokens: 0,
      callCount: 0,
      deletedAt: null,
      read: false,
    })
    const notification = AnalyzeJobNotificationSchema.parse({
      ...job,
      firebaseUid: 'firebase-user-1',
    })

    expect(job.credentialId).toBe('credential-1')
    expectSecretFree(job)
    expectSecretFree(notification)
  })

  it('strips an injected key from telemetry and redacts it from logs', () => {
    const telemetry = AgentTelemetrySchema.parse({
      jobId: 'job-1',
      billId: 'bill-1',
      tokensInput: 1,
      tokensOutput: 1,
      tokensTotal: 2,
      model: 'gpt-4o-mini',
      preset: 'balanced',
      temperature: 0.4,
      duration: 10,
      attempts: 1,
      status: 'success',
      promptVersion: 'v1',
      timestamp: new Date(),
      apiKey,
    })

    expectSecretFree(telemetry)
    expect(sanitizeLogValue({ apiKey, nested: { token: apiKey } })).toEqual({
      apiKey: '[REDACTED]',
      nested: { token: '[REDACTED]' },
    })
    expect(sanitizeLogValue(`provider rejected ${apiKey}`)).not.toContain(apiKey)
  })
})
