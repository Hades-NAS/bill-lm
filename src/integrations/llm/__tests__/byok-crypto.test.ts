import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { createProviderSecretCipher } from '../byok-crypto.server'

const context = {
  userId: '3c42c362-7c52-4f2e-962e-9d19c0c96b77',
  connectionId: '56a6a8fa-b5b8-4fe7-bf2f-54e3bf1a0929',
  provider: 'openai',
  version: 1,
}

describe('BYOK provider-secret cipher', () => {
  it('decrypts only with the exact owner, connection, provider and version', () => {
    const cipher = createProviderSecretCipher(
      randomBytes(32).toString('base64'),
    )
    const encrypted = cipher.encrypt('test-secret-not-a-real-key', context)

    expect(cipher.decrypt(encrypted, context)).toBe(
      'test-secret-not-a-real-key',
    )
    expect(() =>
      cipher.decrypt(encrypted, { ...context, userId: 'other-user' }),
    ).toThrow()
    expect(() =>
      cipher.decrypt(encrypted, {
        ...context,
        connectionId: 'other-connection',
      }),
    ).toThrow()
    expect(() =>
      cipher.decrypt(encrypted, { ...context, provider: 'claude' }),
    ).toThrow()
    expect(() =>
      cipher.decrypt(encrypted, { ...context, version: 2 }),
    ).toThrow()
  })
})
