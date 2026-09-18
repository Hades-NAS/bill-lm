import {
  AuthIdentityLinkInputSchema,
  AuthIdentityLookupSchema,
  PrincipalSchema,
} from '#/schema/auth-identity'

import type {
  AuthIdentityLinkInput,
  AuthIdentityLookup,
  AuthIdentityResolution,
  Principal,
} from '#/schema/auth-identity'

export type StoredAuthIdentity = AuthIdentityLinkInput & {
  disabledAt: Date | null
}

export type AuthIdentityRepository = {
  findIdentity: (
    identity: AuthIdentityLookup,
  ) => Promise<StoredAuthIdentity | null>
  findUser: (userId: string) => Promise<{ primaryEmail: string | null } | null>
  createIdentity: (
    identity: AuthIdentityLinkInput,
  ) => Promise<StoredAuthIdentity>
}

export class AuthIdentityConflictError extends Error {
  constructor() {
    super('The provider identity is already linked to a different user')
    this.name = 'AuthIdentityConflictError'
  }
}

export async function resolveAuthIdentity(
  repository: AuthIdentityRepository,
  value: AuthIdentityLookup,
): Promise<AuthIdentityResolution> {
  const identity = AuthIdentityLookupSchema.parse(value)
  const storedIdentity = await repository.findIdentity(identity)

  if (!storedIdentity) {
    return { status: 'missing' }
  }

  if (storedIdentity.disabledAt) {
    return { status: 'disabled' }
  }

  const user = await repository.findUser(storedIdentity.userId)
  if (!user) {
    return { status: 'orphaned' }
  }

  const principal: Principal = PrincipalSchema.parse({
    ...identity,
    userId: storedIdentity.userId,
    primaryEmail: user.primaryEmail ?? undefined,
  })

  return { status: 'resolved', principal }
}

export async function linkAuthIdentity(
  repository: AuthIdentityRepository,
  value: AuthIdentityLinkInput,
): Promise<StoredAuthIdentity> {
  const identity = AuthIdentityLinkInputSchema.parse(value)
  const existing = await repository.findIdentity(identity)

  if (existing) {
    if (existing.userId !== identity.userId) {
      throw new AuthIdentityConflictError()
    }

    return existing
  }

  return repository.createIdentity(identity)
}
