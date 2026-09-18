import { describe, expect, it } from 'vitest'

import {
  AuthIdentityConflictError,
  linkAuthIdentity,
  resolveAuthIdentity,
} from '../auth-identity-resolver'

import type {
  AuthIdentityRepository,
  StoredAuthIdentity,
} from '../auth-identity-resolver'

function createRepository({
  identity = null,
  user = { primaryEmail: 'user@example.test' },
}: {
  identity?: StoredAuthIdentity | null
  user?: { primaryEmail: string | null } | null
} = {}): AuthIdentityRepository {
  return {
    findIdentity: async () => identity,
    findUser: async () => user,
    createIdentity: async (value) => ({ ...value, disabledAt: null }),
  }
}

describe('resolveAuthIdentity', () => {
  it('does not manufacture an internal user for an unknown provider subject', async () => {
    const result = await resolveAuthIdentity(createRepository(), {
      provider: 'firebase',
      subject: 'unknown-subject',
    })

    expect(result).toEqual({ status: 'missing' })
  })

  it('resolves a verified provider subject to the internal user ID', async () => {
    const result = await resolveAuthIdentity(
      createRepository({
        identity: {
          provider: 'firebase',
          subject: 'firebase-subject',
          userId: 'internal-user-id',
          disabledAt: null,
        },
      }),
      { provider: 'firebase', subject: 'firebase-subject' },
    )

    expect(result).toEqual({
      status: 'resolved',
      principal: {
        provider: 'firebase',
        subject: 'firebase-subject',
        userId: 'internal-user-id',
        primaryEmail: 'user@example.test',
      },
    })
  })

  it('does not resolve a disabled identity', async () => {
    const result = await resolveAuthIdentity(
      createRepository({
        identity: {
          provider: 'firebase',
          subject: 'disabled-firebase-user',
          userId: 'internal-user-id',
          disabledAt: new Date(),
        },
      }),
      { provider: 'firebase', subject: 'disabled-firebase-user' },
    )

    expect(result).toEqual({ status: 'disabled' })
  })
})

describe('linkAuthIdentity', () => {
  it('rejects a provider subject that belongs to another internal user', async () => {
    await expect(
      linkAuthIdentity(
        createRepository({
          identity: {
            provider: 'firebase',
            subject: 'firebase-subject',
            userId: 'first-user',
            disabledAt: null,
          },
        }),
        {
          provider: 'firebase',
          subject: 'firebase-subject',
          userId: 'second-user',
        },
      ),
    ).rejects.toBeInstanceOf(AuthIdentityConflictError)
  })
})
