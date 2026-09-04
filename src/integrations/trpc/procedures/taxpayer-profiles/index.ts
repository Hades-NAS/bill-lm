import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import {
  EconomicActivityRevisionInputSchema,
  TaxpayerProfileRevisionInputSchema,
} from '#/schema/tax-analysis-v2'

import { prisma } from '#/integrations/prisma'

import { privateProcedure } from '../../init'

import type { TRPCRouterRecord } from '@trpc/server'

const IdInputSchema = z.object({ id: z.string().uuid() })

const latestActivityInclude = {
  revisions: {
    orderBy: { revision: 'desc' as const },
    take: 1,
  },
} as const

const latestProfileInclude = {
  revisions: {
    orderBy: { revision: 'desc' as const },
    take: 1,
    include: {
      activities: {
        include: {
          economicActivityRevision: {
            include: { activity: true },
          },
        },
      },
    },
  },
} as const

async function requireActivity(userId: string, id: string) {
  const activity = await prisma.economicActivity.findFirst({
    where: { id, userId, deletedAt: null },
  })
  if (!activity)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Actividad no encontrada' })
  return activity
}

async function requireProfile(userId: string, id: string) {
  const profile = await prisma.taxpayerProfile.findFirst({
    where: { id, userId, deletedAt: null },
  })
  if (!profile)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Perfil no encontrado' })
  return profile
}

async function ensureOwnedActivityRevisions(userId: string, ids: string[]) {
  const activities = await prisma.economicActivityRevision.findMany({
    where: { id: { in: ids }, userId, activity: { deletedAt: null } },
    select: { id: true },
  })
  if (activities.length !== ids.length)
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Selecciona únicamente revisiones de actividades propias vigentes.',
    })
}

export const taxpayerProfilesRouter = {
  listActivities: privateProcedure.query(async ({ ctx }) =>
    prisma.economicActivity.findMany({
      where: { userId: ctx.principal.userId, deletedAt: null },
      include: latestActivityInclude,
      orderBy: { updatedAt: 'desc' },
    }),
  ),
  createActivity: privateProcedure
    .input(EconomicActivityRevisionInputSchema)
    .mutation(async ({ input, ctx }) =>
      prisma.$transaction(async (tx) => {
        const activity = await tx.economicActivity.create({
          data: { userId: ctx.principal.userId },
        })
        return tx.economicActivityRevision.create({
          data: {
            ...input,
            activityId: activity.id,
            userId: ctx.principal.userId,
            revision: 1,
          },
        })
      }),
    ),
  reviseActivity: privateProcedure
    .input(IdInputSchema.merge(EconomicActivityRevisionInputSchema))
    .mutation(async ({ input, ctx }) => {
      const { id: activityId, ...revisionInput } = input
      await requireActivity(ctx.principal.userId, activityId)
      const latest = await prisma.economicActivityRevision.findFirst({
        where: { activityId, userId: ctx.principal.userId },
        orderBy: { revision: 'desc' },
      })
      return prisma.economicActivityRevision.create({
        data: {
          ...revisionInput,
          activityId,
          userId: ctx.principal.userId,
          revision: (latest?.revision ?? 0) + 1,
        },
      })
    }),
  listProfiles: privateProcedure.query(async ({ ctx }) =>
    prisma.taxpayerProfile.findMany({
      where: { userId: ctx.principal.userId, deletedAt: null },
      include: latestProfileInclude,
      orderBy: { updatedAt: 'desc' },
    }),
  ),
  createProfile: privateProcedure
    .input(TaxpayerProfileRevisionInputSchema)
    .mutation(async ({ input, ctx }) => {
      await ensureOwnedActivityRevisions(
        ctx.principal.userId,
        input.activityRevisionIds,
      )
      return prisma.$transaction(async (tx) => {
        const profile = await tx.taxpayerProfile.create({
          data: { userId: ctx.principal.userId },
        })
        const revision = await tx.taxpayerProfileRevision.create({
          data: {
            userId: ctx.principal.userId,
            taxpayerProfileId: profile.id,
            revision: 1,
            displayName: input.displayName,
            personalIdNumber: input.personalIdNumber,
            professionalIdNumber: input.professionalIdNumber,
            hasEmploymentIncome: input.hasEmploymentIncome,
            hasRuc: input.hasRuc,
            taxRegime: input.taxRegime,
            vatFilingFrequency: input.vatFilingFrequency,
            additionalFacts: input.additionalFacts,
          },
        })
        await tx.taxpayerProfileActivityRevision.createMany({
          data: input.activityRevisionIds.map((economicActivityRevisionId) => ({
            userId: ctx.principal.userId,
            taxpayerProfileRevisionId: revision.id,
            economicActivityRevisionId,
          })),
        })
        return revision
      })
    }),
  reviseProfile: privateProcedure
    .input(IdInputSchema.merge(TaxpayerProfileRevisionInputSchema))
    .mutation(async ({ input, ctx }) => {
      const { id: taxpayerProfileId, ...revisionInput } = input
      await requireProfile(ctx.principal.userId, taxpayerProfileId)
      await ensureOwnedActivityRevisions(
        ctx.principal.userId,
        revisionInput.activityRevisionIds,
      )
      return prisma.$transaction(async (tx) => {
        const latest = await tx.taxpayerProfileRevision.findFirst({
          where: { taxpayerProfileId, userId: ctx.principal.userId },
          orderBy: { revision: 'desc' },
        })
        const revision = await tx.taxpayerProfileRevision.create({
          data: {
            userId: ctx.principal.userId,
            taxpayerProfileId,
            revision: (latest?.revision ?? 0) + 1,
            displayName: revisionInput.displayName,
            personalIdNumber: revisionInput.personalIdNumber,
            professionalIdNumber: revisionInput.professionalIdNumber,
            hasEmploymentIncome: revisionInput.hasEmploymentIncome,
            hasRuc: revisionInput.hasRuc,
            taxRegime: revisionInput.taxRegime,
            vatFilingFrequency: revisionInput.vatFilingFrequency,
            additionalFacts: revisionInput.additionalFacts,
          },
        })
        await tx.taxpayerProfileActivityRevision.createMany({
          data: revisionInput.activityRevisionIds.map((economicActivityRevisionId) => ({
            userId: ctx.principal.userId,
            taxpayerProfileRevisionId: revision.id,
            economicActivityRevisionId,
          })),
        })
        return revision
      })
    }),
} satisfies TRPCRouterRecord
