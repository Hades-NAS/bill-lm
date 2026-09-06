import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AnalysisExecutionEnvelopeSchema } from '#/schema/tax-analysis'

const mocks = vi.hoisted(() => ({
  analysisRunFindFirst: vi.fn(),
  analysisRunUpdateMany: vi.fn(),
  providerConnectionFindFirst: vi.fn(),
  collectionFindFirst: vi.fn(),
  decryptProviderSecret: vi.fn(),
  createProvider: vi.fn(),
  useCaseProvider: vi.fn(),
  execute: vi.fn(),
  analysisResultCreateMany: vi.fn(),
  firebaseUpdate: vi.fn(),
  env: {
    ANALYZE_QUEUE_NAME: 'test',
    LLM_MAX_TOKENS: '2048',
    LLM_TIMEOUT_MS: '30000',
    LLM_SMOKE_TEST: false,
  },
}))

vi.mock('bullmq', () => ({ Worker: class {} }))
vi.mock('#/env', () => ({
  env: mocks.env,
}))
vi.mock('#/integrations/firebase/firebase.server', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({ update: mocks.firebaseUpdate })),
    })),
  },
}))
vi.mock('#/integrations/logger.server', () => ({
  getServiceLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}))
vi.mock('#/integrations/prisma', () => ({
  prisma: {
    analysisRun: {
      findFirst: mocks.analysisRunFindFirst,
      updateMany: mocks.analysisRunUpdateMany,
      update: vi.fn(),
    },
    providerConnection: { findFirst: mocks.providerConnectionFindFirst },
    collection: { findFirst: mocks.collectionFindFirst },
    analysisResult: { createMany: mocks.analysisResultCreateMany },
  },
}))
vi.mock('#/integrations/redis', () => ({ redisConnection: {} }))
vi.mock('#/integrations/llm/byok-crypto.server', () => ({
  decryptProviderSecret: mocks.decryptProviderSecret,
}))
vi.mock('#/integrations/llm/llm-provider-factory', () => ({
  LLMProviderFactory: class {
    create = mocks.createProvider
  },
}))
vi.mock('#/use-cases/analyze-bills.use-case', () => ({
  createAnalyzeBillsUseCase: (provider: unknown) => {
    mocks.useCaseProvider(provider)
    return { execute: mocks.execute }
  },
}))

import { jobHandler } from '../analyze-job'

const RUN_ID = '11111111-1111-4111-8111-111111111111'
const COLLECTION_ID = '22222222-2222-4222-8222-222222222222'
const CONTEXT_ID = '33333333-3333-4333-8333-333333333333'
const PROFILE_ID = '44444444-4444-4444-8444-444444444444'
const RULESET_ID = '55555555-5555-4555-8555-555555555555'
const CONNECTION_ID = '66666666-6666-4666-8666-666666666666'
const BILL_ID = '77777777-7777-4777-8777-777777777777'
const ACTIVITY_ID = '88888888-8888-4888-8888-888888888888'

type Purpose = 'vat_credit' | 'business_income_tax' | 'personal_expenses'

function envelope(purpose: Purpose = 'personal_expenses') {
  const requiresActivities = purpose !== 'personal_expenses'
  return AnalysisExecutionEnvelopeSchema.parse({
    schemaVersion: 'v2',
    envelopeVersion: '1',
    prompt: {
      templateId: 'bill-analysis',
      templateVersion: '2',
      templateHash: 'a'.repeat(64),
    },
    context: {
      collectionContextRevisionId: CONTEXT_ID,
      revision: 1,
      purpose,
      period: { startDate: '2026-01-01', endDate: '2026-12-31' },
      notes: null,
    },
    taxpayerProfile: {
      revisionId: PROFILE_ID,
      revision: 1,
      hasRuc: requiresActivities,
      hasEmploymentIncome: purpose === 'personal_expenses',
      taxRegime: requiresActivities ? 'general' : 'unknown',
      vatFilingFrequency: purpose === 'vat_credit' ? 'monthly' : 'none',
      additionalFacts: null,
    },
    activities: requiresActivities
      ? [
          {
            revisionId: ACTIVITY_ID,
            revision: 1,
            displayName: 'Servicios profesionales',
            registeredActivityCode: 'M7410.01',
            registeredActivityName: 'Servicios profesionales',
            activityDescription: 'Prestación de servicios profesionales.',
            necessaryPurchases: null,
            revenueVatTreatment: 'taxed_nonzero',
            additionalFacts: null,
          },
        ]
      : [],
    provider: { id: CONNECTION_ID, provider: 'OPENAI', modelId: 'gpt-4o-mini' },
    ruleset: {
      id: RULESET_ID,
      version: 1,
      contentHash: 'ruleset',
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
    },
    officialEvidence: [
      {
        ruleSetFragmentId: RULESET_ID,
        fragmentId: RULESET_ID,
        fragmentContentHash: 'fragment',
        source: {
          id: RULESET_ID,
          title: 'Norma',
          issuer: 'SRI',
          officialUrl: 'https://www.sri.gob.ec/',
          contentHash: 'source',
        },
        articleOrSection: 'Art. 1',
        purposes: [purpose],
        taxRegimes: [requiresActivities ? 'general' : 'unknown'],
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
        markdown: 'Norma aplicable.',
      },
    ],
    userReferences: [],
    invoices: [
      {
        billId: BILL_ID,
        contentHash: 'b'.repeat(64),
        parserVersion: 'xml-v1',
        normalized: {
          vendorName: 'Proveedor',
          buyerIdentifier: '0102030405',
          buyerName: 'Contribuyente',
          details: [{ description: 'Servicio', quantity: 1, unitPrice: 10 }],
          totals: { amount: 11.5, net: 10, taxes: 1.5 },
          billType: 'PERSONAL',
        },
      },
    ],
  })
}

function run(overrides: Record<string, unknown> = {}) {
  return {
    id: RUN_ID,
    userId: 'user-1',
    status: 'queued',
    inputSnapshot: envelope(),
    collectionId: COLLECTION_ID,
    collectionContextRevisionId: CONTEXT_ID,
    taxpayerProfileRevisionId: PROFILE_ID,
    ruleSetId: RULESET_ID,
    providerConnectionId: CONNECTION_ID,
    provider: 'OPENAI',
    modelId: 'gpt-4o-mini',
    ...overrides,
  }
}

function specializedResult(purpose: Purpose) {
  const common = {
    schemaVersion: 'v2' as const,
    runId: RUN_ID,
    invoiceId: BILL_ID,
    purpose,
    classification: 'eligible' as const,
    reasoning:
      'La factura tiene soporte suficiente para la clasificación orientativa.',
    uncertainties: [],
    createdAt: new Date(),
    advisoryNotice:
      'Resultado orientativo; no constituye un dictamen jurídico ni una determinación del SRI.',
    references: {
      official: [
        {
          sourceId: RULESET_ID,
          sourceContentHash: 'source',
          fragmentId: RULESET_ID,
          fragmentContentHash: 'fragment',
          articleOrSection: 'Art. 1',
        },
      ],
      user: [],
    },
  }

  switch (purpose) {
    case 'vat_credit':
      return {
        ...common,
        relatedActivityRevisionIds: [ACTIVITY_ID],
        invoiceVatAmount: 1.5,
        potentialCreditableVatAmount: 1.5,
        creditablePercentage: 100,
        creditType: 'total' as const,
        proportionalityRequired: false,
        missingEvidence: [],
      }
    case 'business_income_tax':
      return {
        ...common,
        relatedActivityRevisionIds: [ACTIVITY_ID],
        businessUsePercentage: 100,
        potentialExpenseAmount: 11.5,
        mixedUseDetected: false,
        substantiationIssues: [],
        missingEvidence: [],
      }
    case 'personal_expenses':
      return {
        ...common,
        personalExpenseCategory: 'Salud',
        potentialEligibleAmount: 11.5,
        beneficiaryRelationship: 'Titular',
        missingEvidence: [],
      }
  }
}

const job = () =>
  ({
    data: {
      jobId: 'job-1',
      userId: 'user-1',
      credentialId: CONNECTION_ID,
      analysisRunId: RUN_ID,
      percentage: 0,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      callCount: 0,
      totalTokens: 0,
      deletedAt: null,
      read: false,
      data: {
        collectionId: COLLECTION_ID,
        collectionName: 'Colección',
        type: 'all',
        billIds: [BILL_ID],
        credentialId: CONNECTION_ID,
      },
    },
  }) as any

describe('analyze worker fail-closed gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.analysisRunFindFirst.mockResolvedValue(run())
    mocks.analysisRunUpdateMany.mockResolvedValue({ count: 1 })
    mocks.collectionFindFirst.mockResolvedValue({ id: COLLECTION_ID })
    mocks.firebaseUpdate.mockResolvedValue(undefined)
    mocks.env.LLM_SMOKE_TEST = false
  })

  it.each([
    ['inactive provider', null],
    [
      'mismatched provider',
      { id: CONNECTION_ID, provider: 'OPENAI', modelId: 'other-model' },
    ],
  ])(
    'does not decrypt or invoke an LLM for an %s',
    async (_name, connection) => {
      mocks.providerConnectionFindFirst.mockResolvedValue(connection)

      await jobHandler(job())

      expect(mocks.decryptProviderSecret).not.toHaveBeenCalled()
      expect(mocks.createProvider).not.toHaveBeenCalled()
      expect(mocks.execute).not.toHaveBeenCalled()
    },
  )

  it('does not decrypt or invoke an LLM for a stale envelope or missing collection', async () => {
    mocks.analysisRunFindFirst.mockResolvedValue(
      run({ ruleSetId: 'stale-ruleset' }),
    )

    await jobHandler(job())

    expect(mocks.decryptProviderSecret).not.toHaveBeenCalled()
    expect(mocks.createProvider).not.toHaveBeenCalled()

    mocks.analysisRunFindFirst.mockResolvedValue(run())
    mocks.collectionFindFirst.mockResolvedValue(null)
    mocks.providerConnectionFindFirst.mockResolvedValue(null)
    await jobHandler(job())
    expect(mocks.decryptProviderSecret).not.toHaveBeenCalled()
  })

  it('does not decrypt or create a provider when fixed evidence stops being applicable', async () => {
    const staleEvidence = envelope()
    staleEvidence.officialEvidence[0].purposes = ['vat_credit']
    mocks.analysisRunFindFirst.mockResolvedValue(
      run({ inputSnapshot: staleEvidence }),
    )
    mocks.providerConnectionFindFirst.mockResolvedValue({
      id: CONNECTION_ID,
      provider: 'OPENAI',
      modelId: 'gpt-4o-mini',
    })

    await jobHandler(job())

    expect(mocks.decryptProviderSecret).not.toHaveBeenCalled()
    expect(mocks.createProvider).not.toHaveBeenCalled()
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('does not query credentials or invoke an LLM after a lost atomic claim', async () => {
    mocks.analysisRunUpdateMany.mockResolvedValueOnce({ count: 0 })

    await jobHandler(job())

    expect(mocks.providerConnectionFindFirst).not.toHaveBeenCalled()
    expect(mocks.decryptProviderSecret).not.toHaveBeenCalled()
    expect(mocks.createProvider).not.toHaveBeenCalled()
    expect(mocks.execute).not.toHaveBeenCalled()
  })
})

describe('analyze worker canonical result persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.analysisRunFindFirst.mockResolvedValue(run())
    mocks.analysisRunUpdateMany.mockResolvedValue({ count: 1 })
    mocks.collectionFindFirst.mockResolvedValue({ id: COLLECTION_ID })
    mocks.providerConnectionFindFirst.mockResolvedValue({
      id: CONNECTION_ID,
      provider: 'OPENAI',
      modelId: 'gpt-4o-mini',
      secretCiphertext: 'cipher',
      secretIv: 'iv',
      secretAuthTag: 'tag',
      secretVersion: 1,
    })
    mocks.decryptProviderSecret.mockReturnValue('key')
    mocks.createProvider.mockReturnValue({})
    mocks.firebaseUpdate.mockResolvedValue(undefined)
  })

  it.each<[Purpose]>([
    ['vat_credit'],
    ['business_income_tax'],
    ['personal_expenses'],
  ])(
    'persists the canonical specialized snapshot for %s without legacy fields',
    async (purpose) => {
      const snapshot = specializedResult(purpose)
      mocks.analysisRunFindFirst.mockResolvedValue(
        run({ inputSnapshot: envelope(purpose) }),
      )
      mocks.execute.mockResolvedValue([
        { billId: BILL_ID, success: true, result: snapshot },
      ])

      await jobHandler(job())

      expect(mocks.execute).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ billId: BILL_ID })]),
        expect.anything(),
        expect.any(String),
        expect.objectContaining({
          context: expect.objectContaining({ purpose }),
        }),
      )
      expect(mocks.analysisResultCreateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skipDuplicates: true,
          data: [
            expect.objectContaining({
              runId: RUN_ID,
              billId: BILL_ID,
              purpose,
              classification: 'eligible',
              resultSnapshot: expect.objectContaining({
                ...snapshot,
                createdAt: snapshot.createdAt.toJSON(),
              }),
            }),
          ],
        }),
      )
      const persisted = mocks.analysisResultCreateMany.mock.calls[0][0].data[0]
      expect(persisted.resultSnapshot).not.toHaveProperty('percentage')
      expect(persisted.resultSnapshot).not.toHaveProperty('reason')
    },
  )

  it('allows only one concurrent worker to claim and execute an immutable run', async () => {
    mocks.execute.mockResolvedValue([
      {
        billId: BILL_ID,
        success: true,
        result: specializedResult('personal_expenses'),
      },
    ])
    mocks.analysisRunUpdateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })

    await Promise.all([jobHandler(job()), jobHandler(job())])

    expect(mocks.analysisRunUpdateMany).toHaveBeenCalledTimes(2)
    expect(mocks.decryptProviderSecret).toHaveBeenCalledTimes(1)
    expect(mocks.createProvider).toHaveBeenCalledTimes(1)
    expect(mocks.execute).toHaveBeenCalledTimes(1)
    expect(mocks.analysisResultCreateMany).toHaveBeenCalledTimes(1)
  })

  it('marks an operational provider failure as failed without persisting a result', async () => {
    mocks.execute.mockRejectedValue(new Error('Proveedor no disponible'))

    await jobHandler(job())

    expect(mocks.analysisResultCreateMany).not.toHaveBeenCalled()
    expect(mocks.analysisRunUpdateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: RUN_ID,
          status: { in: ['queued', 'running'] },
        }),
        data: expect.objectContaining({ status: 'failed' }),
      }),
    )
  })
})

describe('analyze worker smoke mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.env.LLM_SMOKE_TEST = true
    mocks.analysisRunFindFirst.mockResolvedValue(
      run({ inputSnapshot: envelope('personal_expenses') }),
    )
    mocks.analysisRunUpdateMany.mockResolvedValue({ count: 1 })
    mocks.collectionFindFirst.mockResolvedValue({ id: COLLECTION_ID })
    mocks.providerConnectionFindFirst.mockResolvedValue({
      id: CONNECTION_ID,
      provider: 'OPENAI',
      modelId: 'gpt-4o-mini',
      secretCiphertext: 'cipher',
      secretIv: 'iv',
      secretAuthTag: 'tag',
      secretVersion: 1,
    })
    mocks.decryptProviderSecret.mockReturnValue('key')
    mocks.createProvider.mockReturnValue({})
    mocks.firebaseUpdate.mockResolvedValue(undefined)
  })

  it('blocks before decrypting when server and worker smoke modes differ', async () => {
    await jobHandler(job())

    expect(mocks.decryptProviderSecret).not.toHaveBeenCalled()
    expect(mocks.createProvider).not.toHaveBeenCalled()
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(mocks.analysisRunUpdateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'blocked' }),
      }),
    )
  })

  it('constructs the real client but passes a smoke adapter to the use case', async () => {
    mocks.analysisRunFindFirst.mockResolvedValue(
      run({
        inputSnapshot: AnalysisExecutionEnvelopeSchema.parse({
          ...envelope('personal_expenses'),
          execution: { mode: 'smoke' },
        }),
      }),
    )
    mocks.execute.mockResolvedValue([
      {
        billId: BILL_ID,
        success: true,
        result: specializedResult('personal_expenses'),
      },
    ])

    await jobHandler(job())

    expect(mocks.decryptProviderSecret).toHaveBeenCalledOnce()
    expect(mocks.createProvider).toHaveBeenCalledOnce()
    expect(mocks.useCaseProvider.mock.calls[0][0]).not.toBe(
      mocks.createProvider.mock.results[0].value,
    )
    expect(mocks.execute).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    )
  })
})
