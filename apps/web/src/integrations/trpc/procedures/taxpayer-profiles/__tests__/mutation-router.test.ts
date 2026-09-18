import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createTRPCRouter } from '#/integrations/trpc/init'

import { taxpayerProfilesRouter } from '..'

const mocks = vi.hoisted(() => ({
  activityFindFirst: vi.fn(),
  activityFindMany: vi.fn(),
  activityRevisionFindMany: vi.fn(),
  profileFindFirst: vi.fn(),
  profileFindMany: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('#/integrations/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    economicActivity: {
      findFirst: mocks.activityFindFirst,
      findMany: mocks.activityFindMany,
    },
    economicActivityRevision: { findMany: mocks.activityRevisionFindMany },
    taxpayerProfile: {
      findFirst: mocks.profileFindFirst,
      findMany: mocks.profileFindMany,
    },
    taxpayerProfileRevision: {},
  },
}))
vi.mock('#/integrations/logger.server', () => ({
  getServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

const caller = createTRPCRouter({
  taxpayerProfiles: taxpayerProfilesRouter,
}).createCaller({ principal: { userId: 'owner-1' } } as never)

const ACTIVITY_ID = '11111111-1111-4111-8111-111111111111'
const PROFILE_ID = '22222222-2222-4222-8222-222222222222'
const ACTIVITY_REVISION_ID = '33333333-3333-4333-8333-333333333333'

const activityInput = {
  displayName: 'Software',
  registeredActivityName: 'Development',
  activityDescription: 'Software development',
  revenueVatTreatment: 'taxed_nonzero' as const,
}
const profileInput = {
  displayName: 'Owner',
  hasEmploymentIncome: false,
  hasRuc: true,
  taxRegime: 'general' as const,
  vatFilingFrequency: 'monthly' as const,
  activityRevisionIds: [ACTIVITY_REVISION_ID],
}

function transactionClient() {
  return {
    economicActivity: { create: async ({ data }: { data: object }) => data },
    economicActivityRevision: {
      create: async ({ data }: { data: object }) => ({
        ...data,
        createdAt: new Date('2026-09-13T12:00:00.000Z'),
        registeredActivityCode: null,
        necessaryPurchases: null,
        revenueVatTreatmentOther: null,
        mixedUseDescription: null,
        additionalFacts: null,
      }),
    },
    taxpayerProfile: { create: async ({ data }: { data: object }) => data },
    taxpayerProfileRevision: {
      create: async ({ data }: { data: object }) => ({
        ...data,
        createdAt: new Date('2026-09-13T12:00:00.000Z'),
        personalIdNumber: null,
        professionalIdNumber: null,
        additionalFacts: null,
      }),
    },
    taxpayerProfileActivityRevision: { createMany: async () => ({ count: 1 }) },
  }
}

describe('taxpayer-profile mutation router compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.transaction.mockImplementation((callback) =>
      callback(transactionClient()),
    )
    mocks.activityRevisionFindMany.mockResolvedValue([
      { id: ACTIVITY_REVISION_ID },
    ])
  })

  it('keeps principal scope and legacy Date/userId/null output for all migrated mutations', async () => {
    mocks.activityFindFirst.mockResolvedValue({
      id: ACTIVITY_ID,
      revisions: [
        {
          ...activityInput,
          id: 'old',
          activityId: ACTIVITY_ID,
          revision: 1,
          createdAt: new Date(),
        },
      ],
    })
    mocks.profileFindFirst.mockResolvedValue({
      id: PROFILE_ID,
      revisions: [
        {
          ...profileInput,
          id: 'old-profile',
          taxpayerProfileId: PROFILE_ID,
          revision: 1,
          createdAt: new Date(),
        },
      ],
    })

    const createdActivity =
      await caller.taxpayerProfiles.createActivity(activityInput)
    const revisedActivity = await caller.taxpayerProfiles.reviseActivity({
      id: ACTIVITY_ID,
      ...activityInput,
    })
    const createdProfile =
      await caller.taxpayerProfiles.createProfile(profileInput)
    const revisedProfile = await caller.taxpayerProfiles.reviseProfile({
      id: PROFILE_ID,
      ...profileInput,
    })

    for (const response of [
      createdActivity,
      revisedActivity,
      createdProfile,
      revisedProfile,
    ]) {
      expect(response.createdAt).toBeInstanceOf(Date)
      expect(response.userId).toBe('owner-1')
    }
    expect(createdActivity.registeredActivityCode).toBeNull()
    expect(createdProfile.personalIdNumber).toBeNull()
    expect(mocks.activityFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: ACTIVITY_ID,
          userId: 'owner-1',
          deletedAt: null,
        }),
      }),
    )
    expect(mocks.profileFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: PROFILE_ID,
          userId: 'owner-1',
          deletedAt: null,
        }),
      }),
    )
    expect(mocks.activityRevisionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'owner-1',
          activity: { deletedAt: null },
        }),
      }),
    )
  })

  it('maps missing owned roots and invalid activity revisions to legacy tRPC errors', async () => {
    mocks.activityFindFirst.mockResolvedValue(null)
    await expect(
      caller.taxpayerProfiles.reviseActivity({
        id: ACTIVITY_ID,
        ...activityInput,
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Actividad no encontrada',
    })

    mocks.activityRevisionFindMany.mockResolvedValue([])
    await expect(
      caller.taxpayerProfiles.createProfile(profileInput),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message:
        'Selecciona únicamente revisiones de actividades propias vigentes.',
    })
  })
})
