import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AnalysisExecutionEnvelopeSchema } from '#/schema/tax-analysis'

const mocks = vi.hoisted(() => ({
  analysisRunFindFirst: vi.fn(),
  analysisRunUpdateMany: vi.fn(),
  providerConnectionFindFirst: vi.fn(),
  collectionFindFirst: vi.fn(),
  decryptProviderSecret: vi.fn(),
  createProvider: vi.fn(),
  execute: vi.fn(),
  analysisResultCreateMany: vi.fn(),
  firebaseUpdate: vi.fn(),
}))

vi.mock('bullmq', () => ({ Worker: class {} }))
vi.mock('#/env', () => ({
  env: { ANALYZE_QUEUE_NAME: 'test', LLM_MAX_TOKENS: '2048', LLM_TIMEOUT_MS: '30000' },
}))
vi.mock('#/integrations/firebase/firebase.server', () => ({
  adminDb: {
    collection: vi.fn(() => ({ doc: vi.fn(() => ({ update: mocks.firebaseUpdate })) })),
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
  LLMProviderFactory: class { create = mocks.createProvider },
}))
vi.mock('#/use-cases/analyze-bills.use-case', () => ({
  createAnalyzeBillsUseCase: () => ({ execute: mocks.execute }),
}))

import { jobHandler } from '../analyze-job'

const RUN_ID = '11111111-1111-4111-8111-111111111111'
const COLLECTION_ID = '22222222-2222-4222-8222-222222222222'
const CONTEXT_ID = '33333333-3333-4333-8333-333333333333'
const PROFILE_ID = '44444444-4444-4444-8444-444444444444'
const RULESET_ID = '55555555-5555-4555-8555-555555555555'
const CONNECTION_ID = '66666666-6666-4666-8666-666666666666'
const BILL_ID = '77777777-7777-4777-8777-777777777777'

function envelope() {
  return AnalysisExecutionEnvelopeSchema.parse({
    schemaVersion: 'v2', envelopeVersion: '1',
    prompt: { templateId: 'bill-analysis', templateVersion: '2', templateHash: 'a'.repeat(64) },
    context: { collectionContextRevisionId: CONTEXT_ID, revision: 1, purpose: 'personal_expenses', period: { startDate: '2026-01-01', endDate: '2026-12-31' }, notes: null },
    taxpayerProfile: { revisionId: PROFILE_ID, revision: 1, hasRuc: false, hasEmploymentIncome: true, taxRegime: 'unknown', vatFilingFrequency: 'none', additionalFacts: null },
    activities: [],
    provider: { id: CONNECTION_ID, provider: 'OPENAI', modelId: 'gpt-4o-mini' },
    ruleset: { id: RULESET_ID, version: 1, contentHash: 'ruleset', effectiveFrom: '2026-01-01', effectiveTo: null },
    officialEvidence: [{ ruleSetFragmentId: RULESET_ID, fragmentId: RULESET_ID, fragmentContentHash: 'fragment', source: { id: RULESET_ID, title: 'Norma', issuer: 'SRI', officialUrl: 'https://www.sri.gob.ec/', contentHash: 'source' }, articleOrSection: 'Art. 1', purposes: ['personal_expenses'], taxRegimes: ['unknown'], effectiveFrom: '2026-01-01', effectiveTo: null, markdown: 'Norma aplicable.' }],
    userReferences: [],
    invoices: [{ billId: BILL_ID, contentHash: 'b'.repeat(64), parserVersion: 'xml-v1', normalized: { vendorName: 'Proveedor', buyerIdentifier: '0102030405', buyerName: 'Contribuyente', details: [{ description: 'Servicio', quantity: 1, unitPrice: 10 }], totals: { amount: 11.5, net: 10, taxes: 1.5 }, billType: 'PERSONAL' } }],
  })
}

function run(overrides: Record<string, unknown> = {}) {
  return {
    id: RUN_ID, userId: 'user-1', status: 'queued', inputSnapshot: envelope(),
    collectionId: COLLECTION_ID, collectionContextRevisionId: CONTEXT_ID,
    taxpayerProfileRevisionId: PROFILE_ID, ruleSetId: RULESET_ID,
    providerConnectionId: CONNECTION_ID, provider: 'OPENAI', modelId: 'gpt-4o-mini',
    ...overrides,
  }
}

const job = () => ({
  data: {
    jobId: 'job-1', userId: 'user-1', credentialId: CONNECTION_ID,
    analysisRunId: RUN_ID, percentage: 0, status: 'pending', createdAt: new Date(), updatedAt: new Date(), callCount: 0, totalTokens: 0, deletedAt: null, read: false,
    data: { collectionId: COLLECTION_ID, collectionName: 'Colección', type: 'all', billIds: [BILL_ID], credentialId: CONNECTION_ID },
  },
}) as any

describe('analyze worker fail-closed gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.analysisRunFindFirst.mockResolvedValue(run())
    mocks.analysisRunUpdateMany.mockResolvedValue({ count: 1 })
    mocks.collectionFindFirst.mockResolvedValue({ id: COLLECTION_ID })
    mocks.firebaseUpdate.mockResolvedValue(undefined)
  })

  it.each([
    ['inactive provider', null],
    ['mismatched provider', { id: CONNECTION_ID, provider: 'OPENAI', modelId: 'other-model' }],
  ])('does not decrypt or invoke an LLM for an %s', async (_name, connection) => {
    mocks.providerConnectionFindFirst.mockResolvedValue(connection)

    await jobHandler(job())

    expect(mocks.decryptProviderSecret).not.toHaveBeenCalled()
    expect(mocks.createProvider).not.toHaveBeenCalled()
    expect(mocks.execute).not.toHaveBeenCalled()
  })

  it('does not decrypt or invoke an LLM for a stale envelope or missing collection', async () => {
    mocks.analysisRunFindFirst.mockResolvedValue(run({ ruleSetId: 'stale-ruleset' }))

    await jobHandler(job())

    expect(mocks.decryptProviderSecret).not.toHaveBeenCalled()
    expect(mocks.createProvider).not.toHaveBeenCalled()

    mocks.analysisRunFindFirst.mockResolvedValue(run())
    mocks.collectionFindFirst.mockResolvedValue(null)
    mocks.providerConnectionFindFirst.mockResolvedValue(null)
    await jobHandler(job())
    expect(mocks.decryptProviderSecret).not.toHaveBeenCalled()
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

describe('analyze worker V2 result persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.analysisRunFindFirst.mockResolvedValue(run())
    mocks.analysisRunUpdateMany.mockResolvedValue({ count: 1 })
    mocks.collectionFindFirst.mockResolvedValue({ id: COLLECTION_ID })
    mocks.providerConnectionFindFirst.mockResolvedValue({
      id: CONNECTION_ID, provider: 'OPENAI', modelId: 'gpt-4o-mini',
      secretCiphertext: 'cipher', secretIv: 'iv', secretAuthTag: 'tag', secretVersion: 1,
    })
    mocks.decryptProviderSecret.mockReturnValue('key')
    mocks.createProvider.mockReturnValue({})
    mocks.firebaseUpdate.mockResolvedValue(undefined)
  })

  it('persists only the specialized canonical snapshots, never a fictitious ineligible result', async () => {
    const snapshot = {
      schemaVersion: 'v2', runId: RUN_ID, invoiceId: BILL_ID,
      purpose: 'personal_expenses', classification: 'eligible',
      reasoning: 'Gasto de salud.', uncertainties: [], createdAt: new Date(),
      advisoryNotice: 'Resultado orientativo; no constituye un dictamen jurídico ni una determinación del SRI.',
      references: { official: [{ sourceId: RULESET_ID, sourceContentHash: 'source', fragmentId: RULESET_ID, fragmentContentHash: 'fragment', articleOrSection: 'Art. 1' }], user: [] },
      personalExpenseCategory: 'Salud', potentialEligibleAmount: 11.5,
      beneficiaryRelationship: 'Titular', missingEvidence: [],
    }
    mocks.execute.mockResolvedValue([
      { billId: BILL_ID, success: true, result: snapshot },
      { billId: 'failed-bill', success: false, error: 'Proveedor no disponible' },
    ])

    await jobHandler(job())

    expect(mocks.analysisResultCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({
        runId: RUN_ID, billId: BILL_ID, purpose: 'personal_expenses',
        classification: 'eligible', resultSnapshot: expect.objectContaining({
          ...snapshot,
          createdAt: snapshot.createdAt.toJSON(),
        }),
      })],
    }))
  })
})
