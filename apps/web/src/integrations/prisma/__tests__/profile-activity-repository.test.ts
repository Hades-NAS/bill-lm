import { describe, expect, it } from 'vitest'

import { createPrismaProfileActivityRepository } from '../profile-activity-repository'

import type { PrismaClient } from '#/generated/prisma/client'

const scope = { userId: 'owner' } as const
const timestamp = '2026-09-13T12:00:00.000Z'

function makePrisma() {
  const calls: Array<{ name: string; value: unknown }> = []
  const tx = {
    economicActivity: {
      create: async ({ data }: { data: unknown }) => {
        calls.push({ name: 'activity.create', value: data })
        return data
      },
    },
    economicActivityRevision: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push({ name: 'activityRevision.create', value: data })
        return {
          ...data,
          createdAt: data.createdAt as Date,
          registeredActivityCode: null,
          necessaryPurchases: null,
          revenueVatTreatmentOther: null,
          mixedUseDescription: null,
          additionalFacts: null,
        }
      },
    },
    taxpayerProfile: { create: async () => undefined },
    taxpayerProfileRevision: { create: async () => undefined },
    taxpayerProfileActivityRevision: { createMany: async () => undefined },
  }
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    economicActivity: {
      findMany: async () => [],
      findFirst: async () => null,
    },
    economicActivityRevision: {
      findMany: async ({ where }: { where: unknown }) => {
        calls.push({ name: 'activityRevision.findMany', value: where })
        return []
      },
    },
    taxpayerProfile: { findMany: async () => [], findFirst: async () => null },
    taxpayerProfileRevision: {},
  } as unknown as PrismaClient
  return { prisma, calls }
}

describe('Prisma profile/activity repository', () => {
  it('persists application-generated IDs and timestamp atomically', async () => {
    const { prisma, calls } = makePrisma()
    const repository = createPrismaProfileActivityRepository(prisma)
    const result = await repository.createActivity(scope, {
      id: 'revision-id',
      activityId: 'activity-id',
      revision: 1,
      createdAt: timestamp,
      displayName: 'Software',
      registeredActivityName: 'Software',
      activityDescription: 'Development',
      revenueVatTreatment: 'taxed_nonzero',
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: 'revision-id',
        activityId: 'activity-id',
        createdAt: timestamp,
      },
    })
    expect(calls).toEqual([
      {
        name: 'activity.create',
        value: {
          id: 'activity-id',
          userId: 'owner',
          createdAt: new Date(timestamp),
        },
      },
      expect.objectContaining({
        name: 'activityRevision.create',
        value: expect.objectContaining({
          id: 'revision-id',
          activityId: 'activity-id',
          userId: 'owner',
          createdAt: new Date(timestamp),
        }),
      }),
    ])
  })

  it('constrains activity revision validation by owner and soft deletion', async () => {
    const { prisma, calls } = makePrisma()
    const result = await createPrismaProfileActivityRepository(
      prisma,
    ).validateActivityRevisions(scope, ['foreign-revision'])

    expect(result).toEqual({
      ok: false,
      error: { code: 'activity_revision.invalid' },
    })
    expect(calls[0]).toEqual({
      name: 'activityRevision.findMany',
      value: {
        id: { in: ['foreign-revision'] },
        userId: 'owner',
        activity: { deletedAt: null },
      },
    })
  })
})
