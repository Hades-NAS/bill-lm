import {
  invalidActivityRevision,
  repositoryFailure,
  resourceNotFound,
} from '@bill-lm/application'
import { err, ok } from '@bill-lm/domain'

import type {
  EconomicActivity,
  ProfileActivityRepository,
  TaxpayerProfile,
} from '@bill-lm/application'
import type {
  EconomicActivityRevision,
  TaxpayerProfileRevision,
} from '@bill-lm/domain'
import type { PrismaClient } from '#/generated/prisma/client'

type ProfileActivityPrisma = Pick<
  PrismaClient,
  | '$transaction'
  | 'economicActivity'
  | 'economicActivityRevision'
  | 'taxpayerProfile'
  | 'taxpayerProfileRevision'
>

const latestActivityInclude = {
  revisions: { orderBy: { revision: 'desc' as const }, take: 1 },
} as const

const latestProfileInclude = {
  revisions: { orderBy: { revision: 'desc' as const }, take: 1 },
} as const

function activityRevision(value: {
  id: string
  activityId: string
  revision: number
  createdAt: Date
  displayName: string
  registeredActivityCode: string | null
  registeredActivityName: string
  activityDescription: string
  necessaryPurchases: string | null
  revenueVatTreatment: string
  revenueVatTreatmentOther: string | null
  mixedUseDescription: string | null
  additionalFacts: string | null
}): EconomicActivityRevision {
  return {
    ...value,
    createdAt: value.createdAt.toISOString(),
    registeredActivityCode: value.registeredActivityCode ?? undefined,
    necessaryPurchases: value.necessaryPurchases ?? undefined,
    revenueVatTreatment:
      value.revenueVatTreatment as EconomicActivityRevision['revenueVatTreatment'],
    revenueVatTreatmentOther: value.revenueVatTreatmentOther ?? undefined,
    mixedUseDescription: value.mixedUseDescription ?? undefined,
    additionalFacts: value.additionalFacts ?? undefined,
  }
}

function profileRevision(value: {
  id: string
  taxpayerProfileId: string
  revision: number
  createdAt: Date
  displayName: string
  personalIdNumber: string | null
  professionalIdNumber: string | null
  hasEmploymentIncome: boolean
  hasRuc: boolean
  taxRegime: string
  vatFilingFrequency: string
  additionalFacts: string | null
  activities?: readonly { economicActivityRevisionId: string }[]
}): TaxpayerProfileRevision {
  return {
    ...value,
    createdAt: value.createdAt.toISOString(),
    personalIdNumber: value.personalIdNumber ?? undefined,
    professionalIdNumber: value.professionalIdNumber ?? undefined,
    taxRegime: value.taxRegime as TaxpayerProfileRevision['taxRegime'],
    vatFilingFrequency:
      value.vatFilingFrequency as TaxpayerProfileRevision['vatFilingFrequency'],
    additionalFacts: value.additionalFacts ?? undefined,
    activityRevisionIds:
      value.activities?.map((item) => item.economicActivityRevisionId) ?? [],
  }
}

/** Cloud implementation of the profile/activity application port. */
export function createPrismaProfileActivityRepository(
  prisma: ProfileActivityPrisma,
): ProfileActivityRepository {
  return {
    async listActivities(scope) {
      try {
        const records = await prisma.economicActivity.findMany({
          where: { userId: scope.userId, deletedAt: null },
          include: latestActivityInclude,
          orderBy: { updatedAt: 'desc' },
        })
        return ok(
          records.flatMap((record): EconomicActivity[] => {
            const revision = record.revisions[0]
            return revision
              ? [{ id: record.id, latestRevision: activityRevision(revision) }]
              : []
          }),
        )
      } catch {
        return err(repositoryFailure())
      }
    },
    async findActivity(scope, activityId) {
      try {
        const record = await prisma.economicActivity.findFirst({
          where: { id: activityId, userId: scope.userId, deletedAt: null },
          include: latestActivityInclude,
        })
        const revision = record?.revisions[0]
        return record && revision
          ? ok({ id: record.id, latestRevision: activityRevision(revision) })
          : err(resourceNotFound())
      } catch {
        return err(repositoryFailure())
      }
    },
    async createActivity(scope, revision) {
      try {
        const created = await prisma.$transaction(async (tx) => {
          await tx.economicActivity.create({
            data: {
              id: revision.activityId,
              userId: scope.userId,
              createdAt: new Date(revision.createdAt),
            },
          })
          return tx.economicActivityRevision.create({
            data: {
              ...revision,
              userId: scope.userId,
              createdAt: new Date(revision.createdAt),
            },
          })
        })
        return ok(activityRevision(created))
      } catch {
        return err(repositoryFailure())
      }
    },
    async appendActivityRevision(scope, revision) {
      try {
        const created = await prisma.$transaction(async (tx) =>
          tx.economicActivityRevision.create({
            data: {
              ...revision,
              userId: scope.userId,
              createdAt: new Date(revision.createdAt),
            },
          }),
        )
        return ok(activityRevision(created))
      } catch {
        return err(repositoryFailure())
      }
    },
    async listProfiles(scope) {
      try {
        const records = await prisma.taxpayerProfile.findMany({
          where: { userId: scope.userId, deletedAt: null },
          include: latestProfileInclude,
          orderBy: { updatedAt: 'desc' },
        })
        return ok(
          records.flatMap((record): TaxpayerProfile[] => {
            const revision = record.revisions[0]
            return revision
              ? [{ id: record.id, latestRevision: profileRevision(revision) }]
              : []
          }),
        )
      } catch {
        return err(repositoryFailure())
      }
    },
    async findProfile(scope, profileId) {
      try {
        const record = await prisma.taxpayerProfile.findFirst({
          where: { id: profileId, userId: scope.userId, deletedAt: null },
          include: latestProfileInclude,
        })
        const revision = record?.revisions[0]
        return record && revision
          ? ok({ id: record.id, latestRevision: profileRevision(revision) })
          : err(resourceNotFound())
      } catch {
        return err(repositoryFailure())
      }
    },
    async validateActivityRevisions(scope, activityRevisionIds) {
      try {
        const records = await prisma.economicActivityRevision.findMany({
          where: {
            id: { in: [...activityRevisionIds] },
            userId: scope.userId,
            activity: { deletedAt: null },
          },
          select: { id: true },
        })
        return records.length === activityRevisionIds.length
          ? ok(undefined)
          : err(invalidActivityRevision())
      } catch {
        return err(repositoryFailure())
      }
    },
    async createProfile(scope, revision) {
      try {
        const created = await prisma.$transaction(async (tx) => {
          await tx.taxpayerProfile.create({
            data: {
              id: revision.taxpayerProfileId,
              userId: scope.userId,
              createdAt: new Date(revision.createdAt),
            },
          })
          const { activityRevisionIds, ...data } = revision
          const profileRevision = await tx.taxpayerProfileRevision.create({
            data: {
              ...data,
              userId: scope.userId,
              createdAt: new Date(revision.createdAt),
            },
          })
          await tx.taxpayerProfileActivityRevision.createMany({
            data: activityRevisionIds.map((economicActivityRevisionId) => ({
              userId: scope.userId,
              taxpayerProfileRevisionId: profileRevision.id,
              economicActivityRevisionId,
            })),
          })
          return profileRevision
        })
        return ok(profileRevision(created))
      } catch {
        return err(repositoryFailure())
      }
    },
    async appendProfileRevision(scope, revision) {
      try {
        const created = await prisma.$transaction(async (tx) => {
          const { activityRevisionIds, ...data } = revision
          const profileRevision = await tx.taxpayerProfileRevision.create({
            data: {
              ...data,
              userId: scope.userId,
              createdAt: new Date(revision.createdAt),
            },
          })
          await tx.taxpayerProfileActivityRevision.createMany({
            data: activityRevisionIds.map((economicActivityRevisionId) => ({
              userId: scope.userId,
              taxpayerProfileRevisionId: profileRevision.id,
              economicActivityRevisionId,
            })),
          })
          return profileRevision
        })
        return ok(profileRevision(created))
      } catch {
        return err(repositoryFailure())
      }
    },
  }
}
