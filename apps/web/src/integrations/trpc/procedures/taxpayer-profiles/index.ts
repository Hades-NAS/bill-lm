import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { createProfileActivityUseCases } from '@bill-lm/application'
import type { UseCaseError } from '@bill-lm/application'
import type { Result } from '@bill-lm/domain'

import {
  EconomicActivityRevisionInputSchema,
  TaxpayerProfileRevisionInputSchema,
} from '#/schema/tax-analysis'

import { prisma } from '#/integrations/prisma'
import { createPrismaProfileActivityRepository } from '#/integrations/prisma/profile-activity-repository'

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

const profileActivityUseCases = createProfileActivityUseCases({
  repository: createPrismaProfileActivityRepository(prisma),
  clock: { now: () => new Date() },
  ids: { next: () => crypto.randomUUID() },
})

function mutationResult<Value extends { createdAt: string }>(
  result: Result<Value, UseCaseError>,
  notFoundMessage: string,
): Value {
  if (result.ok) return result.value
  if (result.error.code === 'resource.not_found')
    throw new TRPCError({ code: 'NOT_FOUND', message: notFoundMessage })
  if (
    result.error.code === 'activity_revision.invalid' ||
    result.error.code === 'activity_revision.duplicate'
  )
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message:
        'Selecciona únicamente revisiones de actividades propias vigentes.',
    })
  if (result.error.code === 'repository.failure')
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'No fue posible guardar los cambios.',
    })
  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'Los datos del perfil o actividad no son válidos.',
  })
}

function legacyResponse<Value extends { createdAt: string }>(
  value: Value,
  userId: string,
) {
  return Object.fromEntries(
    Object.entries({
      ...value,
      userId,
      createdAt: new Date(value.createdAt),
    }).map(([key, item]) => [key, item === undefined ? null : item]),
  ) as Omit<Value, 'createdAt'> & { userId: string; createdAt: Date }
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
    .mutation(async ({ input, ctx }) => {
      const result = await profileActivityUseCases.createActivity(
        { userId: ctx.principal.userId },
        input,
      )
      return legacyResponse(
        mutationResult(result, 'Actividad no encontrada'),
        ctx.principal.userId,
      )
    }),
  reviseActivity: privateProcedure
    .input(IdInputSchema.merge(EconomicActivityRevisionInputSchema))
    .mutation(async ({ input, ctx }) => {
      const { id: activityId, ...revisionInput } = input
      const result = await profileActivityUseCases.reviseActivity(
        { userId: ctx.principal.userId },
        activityId,
        revisionInput,
      )
      return legacyResponse(
        mutationResult(result, 'Actividad no encontrada'),
        ctx.principal.userId,
      )
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
      const result = await profileActivityUseCases.createProfile(
        { userId: ctx.principal.userId },
        input,
      )
      return legacyResponse(
        mutationResult(result, 'Perfil no encontrado'),
        ctx.principal.userId,
      )
    }),
  reviseProfile: privateProcedure
    .input(IdInputSchema.merge(TaxpayerProfileRevisionInputSchema))
    .mutation(async ({ input, ctx }) => {
      const { id: taxpayerProfileId, ...revisionInput } = input
      const result = await profileActivityUseCases.reviseProfile(
        { userId: ctx.principal.userId },
        taxpayerProfileId,
        revisionInput,
      )
      return legacyResponse(
        mutationResult(result, 'Perfil no encontrado'),
        ctx.principal.userId,
      )
    }),
} satisfies TRPCRouterRecord
