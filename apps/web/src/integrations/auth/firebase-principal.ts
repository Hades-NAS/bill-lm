import {
  AuthenticationFailureCodeSchema,
  FirebaseIdentityProvisionInputSchema,
  PrincipalSchema,
} from '#/schema/auth-identity'

import { resolveAuthIdentity } from './auth-identity-resolver'

import type {
  AuthenticationFailureCode,
  FirebaseIdentityProvisionInput,
  Principal,
} from '#/schema/auth-identity'
import type { AuthIdentityRepository } from './auth-identity-resolver'

export type FirebaseTokenVerifier = {
  verifyIdToken: (
    token: string,
    checkRevoked: boolean,
  ) => Promise<{ uid: string; email?: string; email_verified?: boolean }>
}

export type FirebaseIdentityProvisioner = {
  provisionFirebaseIdentity: (
    value: FirebaseIdentityProvisionInput,
  ) => Promise<Principal>
}

export type FirebasePrincipalResult =
  | { principal: Principal; failure: null }
  | { principal: null; failure: AuthenticationFailureCode }

function getBearerToken(authorization: string | null): string | null {
  if (!authorization) {
    return null
  }

  const [scheme, token, ...rest] = authorization.trim().split(/\s+/)
  if (scheme !== 'Bearer' || !token || rest.length > 0) {
    return null
  }

  return token
}

function getTokenFailureCode(error: unknown): AuthenticationFailureCode {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String(error.code)
      : ''

  return AuthenticationFailureCodeSchema.parse(
    code === 'auth/id-token-revoked' || code === 'auth/user-disabled'
      ? 'revoked-token'
      : 'invalid-token',
  )
}

export async function resolveFirebasePrincipal({
  authorization,
  verifier,
  repository,
}: {
  authorization: string | null
  verifier: FirebaseTokenVerifier
  repository: AuthIdentityRepository & FirebaseIdentityProvisioner
}): Promise<FirebasePrincipalResult> {
  const token = getBearerToken(authorization)
  if (!token) {
    return { principal: null, failure: 'missing-bearer-token' }
  }

  let decodedToken: Awaited<ReturnType<FirebaseTokenVerifier['verifyIdToken']>>
  try {
    decodedToken = await verifier.verifyIdToken(token, true)
  } catch (error) {
    return { principal: null, failure: getTokenFailureCode(error) }
  }

  const resolution = await resolveAuthIdentity(repository, {
    provider: 'firebase',
    subject: decodedToken.uid,
  })

  if (resolution.status === 'resolved') {
    return {
      principal: PrincipalSchema.parse(resolution.principal),
      failure: null,
    }
  }

  if (resolution.status === 'missing') {
    if (!decodedToken.email_verified || !decodedToken.email) {
      return { principal: null, failure: 'email-not-verified' }
    }

    const principal = await repository.provisionFirebaseIdentity(
      FirebaseIdentityProvisionInputSchema.parse({
        subject: decodedToken.uid,
        primaryEmail: decodedToken.email,
      }),
    )

    return {
      principal: PrincipalSchema.parse(principal),
      failure: null,
    }
  }

  return {
    principal: null,
    failure: AuthenticationFailureCodeSchema.parse(
      `identity-${resolution.status}`,
    ),
  }
}
