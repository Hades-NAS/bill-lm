import { describe, expect, it } from 'vitest'

import { resolveFirebasePrincipal } from '../firebase-principal'

import type { AuthIdentityRepository } from '../auth-identity-resolver'
import type {
  FirebaseIdentityProvisioner,
  FirebaseTokenVerifier,
} from '../firebase-principal'

const repository: AuthIdentityRepository & FirebaseIdentityProvisioner = {
  findIdentity: async () => ({
    provider: 'firebase',
    subject: 'firebase-user',
    userId: 'internal-user-id',
    disabledAt: null,
  }),
  findUser: async () => ({ primaryEmail: 'user@example.test' }),
  createIdentity: async (identity) => ({ ...identity, disabledAt: null }),
  provisionFirebaseIdentity: async ({ subject, primaryEmail }) => ({
    provider: 'firebase',
    subject,
    userId: 'provisioned-user-id',
    primaryEmail,
  }),
}

describe('resolveFirebasePrincipal', () => {
  it('rejects a missing Bearer credential before any identity lookup', async () => {
    const verifier: FirebaseTokenVerifier = {
      verifyIdToken: async () => ({ uid: 'firebase-user' }),
    }

    await expect(
      resolveFirebasePrincipal({
        authorization: null,
        verifier,
        repository,
      }),
    ).resolves.toEqual({ principal: null, failure: 'missing-bearer-token' })
  })

  it('verifies a Firebase token with revocation checks before resolving Principal', async () => {
    let checkRevoked: boolean | undefined
    const verifier: FirebaseTokenVerifier = {
      verifyIdToken: async (_token, value) => {
        checkRevoked = value
        return { uid: 'firebase-user' }
      },
    }

    const result = await resolveFirebasePrincipal({
      authorization: 'Bearer signed-token',
      verifier,
      repository,
    })

    expect(checkRevoked).toBe(true)
    expect(result).toEqual({
      principal: {
        provider: 'firebase',
        subject: 'firebase-user',
        userId: 'internal-user-id',
        primaryEmail: 'user@example.test',
      },
      failure: null,
    })
  })

  it('distinguishes a revoked token', async () => {
    const verifier: FirebaseTokenVerifier = {
      verifyIdToken: async () => {
        throw { code: 'auth/id-token-revoked' }
      },
    }

    await expect(
      resolveFirebasePrincipal({
        authorization: 'Bearer revoked-token',
        verifier,
        repository,
      }),
    ).resolves.toEqual({ principal: null, failure: 'revoked-token' })
  })

  it('provisions a verified Firebase account that has no legacy identity', async () => {
    const verifier: FirebaseTokenVerifier = {
      verifyIdToken: async () => ({
        uid: 'new-firebase-user',
        email: 'new@example.test',
        email_verified: true,
      }),
    }
    const emptyRepository: AuthIdentityRepository & FirebaseIdentityProvisioner = {
      ...repository,
      findIdentity: async () => null,
    }

    await expect(
      resolveFirebasePrincipal({
        authorization: 'Bearer verified-token',
        verifier,
        repository: emptyRepository,
      }),
    ).resolves.toEqual({
      principal: {
        provider: 'firebase',
        subject: 'new-firebase-user',
        userId: 'provisioned-user-id',
        primaryEmail: 'new@example.test',
      },
      failure: null,
    })
  })

  it('does not provision a Firebase account with an unverified email', async () => {
    const verifier: FirebaseTokenVerifier = {
      verifyIdToken: async () => ({
        uid: 'unverified-firebase-user',
        email: 'unverified@example.test',
        email_verified: false,
      }),
    }
    const emptyRepository: AuthIdentityRepository & FirebaseIdentityProvisioner = {
      ...repository,
      findIdentity: async () => null,
    }

    await expect(
      resolveFirebasePrincipal({
        authorization: 'Bearer unverified-token',
        verifier,
        repository: emptyRepository,
      }),
    ).resolves.toEqual({ principal: null, failure: 'email-not-verified' })
  })
})
