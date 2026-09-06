import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  collectionFindFirst: vi.fn(),
  collectionContextRevisionFindFirst: vi.fn(),
  providerConnectionFindFirst: vi.fn(),
  analysisRunFindMany: vi.fn(),
  analysisRunFindFirst: vi.fn(),
  analysisRunCreate: vi.fn(),
  analyzeQueueAdd: vi.fn(),
}))

vi.mock('#/integrations/prisma', () => ({
  prisma: {
    collection: { findFirst: mocks.collectionFindFirst },
    collectionContextRevision: {
      findFirst: mocks.collectionContextRevisionFindFirst,
    },
    providerConnection: { findFirst: mocks.providerConnectionFindFirst },
    analysisRun: {
      findMany: mocks.analysisRunFindMany,
      findFirst: mocks.analysisRunFindFirst,
      create: mocks.analysisRunCreate,
      update: vi.fn(),
    },
  },
}))
vi.mock('#/integrations/firebase/firebase.server', () => ({ adminDb: {} }))
vi.mock('#/integrations/logger.server', () => ({
  getServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))
vi.mock('#/integrations/queue/analyze-queue', () => ({
  AnalyzeQueue: { add: mocks.analyzeQueueAdd },
}))
vi.mock('#/integrations/minio/helper', () => ({ StorageHelper: {} }))

import { createTRPCRouter } from '#/integrations/trpc/init'
import { collectionsRouter } from '..'

const COLLECTION_ID = '11111111-1111-4111-8111-111111111111'
const RUN_A = '22222222-2222-4222-8222-222222222222'
const RUN_B = '33333333-3333-4333-8333-333333333333'
const RUN_C = '44444444-4444-4444-8444-444444444444'
const CONNECTION_ID = '55555555-5555-4555-8555-555555555555'
const CONTEXT_ID = '66666666-6666-4666-8666-666666666666'
const PROFILE_ID = '77777777-7777-4777-8777-777777777777'
const caller = createTRPCRouter({
  collections: collectionsRouter,
}).createCaller({
  principal: { userId: 'owner-1' },
} as any)

function run(id: string, createdAt: string) {
  return {
    id,
    status: 'blocked',
    blockCode: 'MISSING_APPLICABLE_RULESET',
    blockMessage: 'Falta un ruleset.',
    provider: null,
    modelId: null,
    promptVersion: '2',
    inputSnapshot: {
      schemaVersion: 'v2',
      blockCode: 'MISSING_APPLICABLE_RULESET',
    },
    createdAt: new Date(createdAt),
    completedAt: new Date(createdAt),
    results: [],
    _count: { invoices: 1 },
  }
}

describe('analysis history router behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(['cross-user', 'archived'])(
    'does not query runs when the collection is %s',
    async () => {
      mocks.collectionFindFirst.mockResolvedValue(null)

      await expect(
        caller.collections.listAnalysisRunHistory({
          collectionId: COLLECTION_ID,
        }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Colección no encontrada.',
      })

      expect(mocks.collectionFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: COLLECTION_ID,
            userId: 'owner-1',
            deletedAt: null,
          }),
        }),
      )
      expect(mocks.analysisRunFindMany).not.toHaveBeenCalled()
    },
  )

  it('returns deterministic cursor pages without duplicate runs', async () => {
    const first = run(RUN_A, '2026-09-05T12:00:03.000Z')
    const second = run(RUN_B, '2026-09-05T12:00:02.000Z')
    const third = run(RUN_C, '2026-09-05T12:00:01.000Z')
    mocks.collectionFindFirst.mockResolvedValue({ id: COLLECTION_ID })
    mocks.analysisRunFindMany.mockImplementation((args) =>
      args.where.OR ? [third] : [first, second, third],
    )

    const pageOne = await caller.collections.listAnalysisRunHistory({
      collectionId: COLLECTION_ID,
      limit: 2,
    })
    expect(pageOne.items.map((item) => item.id)).toEqual([RUN_A, RUN_B])
    expect(pageOne.nextCursor).toEqual({
      createdAt: second.createdAt,
      id: RUN_B,
    })

    const pageTwo = await caller.collections.listAnalysisRunHistory({
      collectionId: COLLECTION_ID,
      limit: 2,
      cursor: pageOne.nextCursor!,
    })
    expect(pageTwo.items.map((item) => item.id)).toEqual([RUN_C])
    expect(pageTwo.nextCursor).toBeNull()
    expect(mocks.analysisRunFindMany.mock.calls[1][0]).toMatchObject({
      where: {
        collectionId: COLLECTION_ID,
        userId: 'owner-1',
        OR: [
          { createdAt: { lt: second.createdAt } },
          { createdAt: second.createdAt, id: { lt: RUN_B } },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
    })
  })

  it('does not return a detail from another collection after collection authorization', async () => {
    mocks.collectionFindFirst.mockResolvedValue({ id: COLLECTION_ID })
    mocks.analysisRunFindFirst.mockResolvedValue(null)

    await expect(
      caller.collections.getAnalysisRunDetail({
        collectionId: COLLECTION_ID,
        runId: RUN_A,
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Análisis no encontrado.',
    })
    expect(mocks.analysisRunFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: RUN_A,
          collectionId: COLLECTION_ID,
          userId: 'owner-1',
        }),
      }),
    )
  })

  it('persists a blocked run and never enqueues when the pre-enqueue gate rejects the context', async () => {
    mocks.collectionFindFirst.mockResolvedValue({
      id: COLLECTION_ID,
      name: 'Prueba',
    })
    mocks.providerConnectionFindFirst.mockResolvedValue({ id: CONNECTION_ID })
    mocks.collectionContextRevisionFindFirst.mockResolvedValue({
      id: CONTEXT_ID,
      revision: 1,
      taxpayerProfileRevisionId: PROFILE_ID,
      purpose: 'vat_credit',
      periodStartDate: new Date('2026-01-01T00:00:00.000Z'),
      periodEndDate: new Date('2026-01-31T00:00:00.000Z'),
      notes: null,
      taxpayerProfileRevision: {
        hasRuc: false,
        taxRegime: 'unknown',
        vatFilingFrequency: 'unknown',
      },
      activities: [],
    })
    mocks.analysisRunCreate.mockResolvedValue({ id: RUN_A })

    await expect(
      caller.collections.analyze({
        collectionId: COLLECTION_ID,
        collectionName: 'Prueba',
        credentialId: CONNECTION_ID,
        type: 'all',
        billIds: [],
      }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' })

    expect(mocks.analysisRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'blocked',
          blockCode: 'MISSING_TAXPAYER_PROFILE',
          collectionId: COLLECTION_ID,
        }),
      }),
    )
    expect(mocks.analyzeQueueAdd).not.toHaveBeenCalled()
  })
})
