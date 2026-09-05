import { describe, expect, it, vi } from 'vitest'

import { createBillAnalysisService } from '../bill-analysis.service'

import type { ILLMProvider } from '#/integrations/llm/provider.interface'
import type { AnalysisExecutionEnvelope } from '#/schema/tax-analysis'

const RUN_ID = '11111111-1111-4111-8111-111111111111'
const BILL_ID = '22222222-2222-4222-8222-222222222222'
const CONTEXT_ID = '33333333-3333-4333-8333-333333333333'
const PROFILE_ID = '44444444-4444-4444-8444-444444444444'
const RULESET_ID = '55555555-5555-4555-8555-555555555555'
const CONNECTION_ID = '66666666-6666-4666-8666-666666666666'

const envelope: AnalysisExecutionEnvelope = {
  schemaVersion: 'v2', envelopeVersion: '1',
  prompt: { templateId: 'bill-analysis', templateVersion: '2', templateHash: 'a'.repeat(64) },
  context: { collectionContextRevisionId: CONTEXT_ID, revision: 1, purpose: 'personal_expenses', period: { startDate: '2026-01-01', endDate: '2026-12-31' }, notes: null },
  taxpayerProfile: { revisionId: PROFILE_ID, revision: 1, hasRuc: false, hasEmploymentIncome: true, taxRegime: 'unknown', vatFilingFrequency: 'none', additionalFacts: null },
  activities: [], provider: { id: CONNECTION_ID, provider: 'OPENAI', modelId: 'gpt-4o-mini' },
  ruleset: { id: RULESET_ID, version: 1, contentHash: 'ruleset', effectiveFrom: '2026-01-01', effectiveTo: null },
  officialEvidence: [{ ruleSetFragmentId: RULESET_ID, fragmentId: RULESET_ID, fragmentContentHash: 'fragment', source: { id: RULESET_ID, title: 'Norma', issuer: 'SRI', officialUrl: 'https://www.sri.gob.ec/', contentHash: 'source' }, articleOrSection: 'Art. 1', purposes: ['personal_expenses'], taxRegimes: ['unknown'], effectiveFrom: '2026-01-01', effectiveTo: null, markdown: 'Norma.' }],
  userReferences: [], invoices: [{ billId: BILL_ID, contentHash: 'b'.repeat(64), parserVersion: 'xml-v1', normalized: { vendorName: 'Proveedor', buyerIdentifier: '0102030405', buyerName: 'Titular', details: [{ description: 'Servicio', quantity: 1, unitPrice: 10 }], totals: { amount: 11.5, net: 10, taxes: 1.5 }, billType: 'PERSONAL' } }],
}

describe('BillAnalysisService canonical result', () => {
  it('returns a canonical needs_review result without updating BillHeader', async () => {
    const provider = {
      getProviderName: () => 'openai', getModelId: () => 'gpt-4o-mini',
      isModelLoaded: async () => true, loadModel: async () => undefined,
      process: vi.fn().mockResolvedValue({
        purpose: 'personal_expenses', classification: 'needs_review',
        reasoning: 'Falta evidencia.', uncertainties: ['Soporte'], missingEvidence: ['Soporte'],
      }),
    } as unknown as ILLMProvider
    const service = createBillAnalysisService({ provider })
    vi.spyOn(service as any, 'updateFirestoreProgress').mockResolvedValue(undefined)

    const results = await service.analyzePreparedBills(
      [{ billId: BILL_ID, parsedBill: envelope.invoices[0].normalized }],
      { jobId: 'job-1', userId: 'user-1', analysisRunId: RUN_ID, data: { collectionId: CONTEXT_ID, collectionName: 'Colección', billIds: [BILL_ID], type: 'all' } } as any,
      { jobId: 'job-1', preset: 'balanced' },
      envelope,
      RUN_ID,
    )

    expect(results[0]).toMatchObject({ success: true })
    expect(results[0].result).toMatchObject({
      advisoryNotice: 'Resultado orientativo; no constituye un dictamen jurídico ni una determinación del SRI.',
      references: {
        official: [{ sourceId: RULESET_ID, fragmentId: RULESET_ID, articleOrSection: 'Art. 1' }],
        user: [],
      },
    })
  })
})
