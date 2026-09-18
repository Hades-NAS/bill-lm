import { describe, expect, it } from 'vitest'

import { AnalyzeJobNotificationSchema } from '../collections'

describe('AnalyzeJobNotificationSchema', () => {
  it('contains Firebase ownership but excludes the internal user identifier', () => {
    const notification = AnalyzeJobNotificationSchema.parse({
      jobId: 'job-1',
      firebaseUid: 'firebase-user-1',
      credentialId: 'credential-1',
      data: {
        collectionId: 'collection-1',
        collectionName: 'Facturas 2026',
        billIds: ['bill-1'],
        type: 'all',
      },
      percentage: 0,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      callCount: 0,
      totalTokens: 0,
      deletedAt: null,
      read: false,
    })

    expect(notification).not.toHaveProperty('userId')
    expect(notification.firebaseUid).toBe('firebase-user-1')
    expect(notification.credentialId).toBe('credential-1')
  })
})
