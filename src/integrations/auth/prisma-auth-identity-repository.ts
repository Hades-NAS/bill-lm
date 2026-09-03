import { AuthProvider as PrismaAuthProvider } from '#/generated/prisma/enums'
import { prisma } from '#/integrations/prisma'

import type {
  AuthIdentityRepository,
  StoredAuthIdentity,
} from './auth-identity-resolver'
import type { FirebaseIdentityProvisioner } from './firebase-principal'
import type {
  AuthIdentityLinkInput,
  AuthIdentityLookup,
  FirebaseIdentityProvisionInput,
  Principal,
} from '#/schema/auth-identity'

function toPrismaProvider(): PrismaAuthProvider {
  return PrismaAuthProvider.FIREBASE
}

function fromPrismaIdentity(identity: {
  provider: PrismaAuthProvider
  subject: string
  userId: string
  disabledAt: Date | null
}): StoredAuthIdentity {
  return {
    provider: 'firebase',
    subject: identity.subject,
    userId: identity.userId,
    disabledAt: identity.disabledAt,
  }
}

export const prismaAuthIdentityRepository: AuthIdentityRepository &
  FirebaseIdentityProvisioner = {
  async findIdentity(identity: AuthIdentityLookup) {
    const storedIdentity = await prisma.authIdentity.findUnique({
      where: {
        auth_identity_provider_subject_key: {
          provider: toPrismaProvider(),
          subject: identity.subject,
        },
      },
    })

    return storedIdentity ? fromPrismaIdentity(storedIdentity) : null
  },

  async findUser(userId) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { primaryEmail: true },
    })
  },

  async createIdentity(identity: AuthIdentityLinkInput) {
    const storedIdentity = await prisma.authIdentity.create({
      data: {
        userId: identity.userId,
        provider: toPrismaProvider(),
        subject: identity.subject,
      },
    })

    return fromPrismaIdentity(storedIdentity)
  },

  async provisionFirebaseIdentity({
    subject,
    primaryEmail,
  }: FirebaseIdentityProvisionInput): Promise<Principal> {
    const user = await prisma.user.create({
      data: {
        primaryEmail,
        authIdentities: {
          create: {
            provider: PrismaAuthProvider.FIREBASE,
            subject,
            verifiedAt: new Date(),
          },
        },
      },
      select: { id: true, primaryEmail: true },
    })

    return {
      provider: 'firebase',
      subject,
      userId: user.id,
      primaryEmail: user.primaryEmail ?? undefined,
    }
  },
}
