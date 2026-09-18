import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  projectAnalysisRunDetail,
  projectAnalysisRunHistoryItem,
} from '../history-projection.server'
import { normalizeTaxAnalysisResult } from '../result-adapter'

const RUN_ID = '11111111-1111-4111-8111-111111111111'
const INVOICE_ID = '22222222-2222-4222-8222-222222222222'
const ACTIVITY_ID = '33333333-3333-4333-8333-333333333333'
const FRAGMENT_ID = '44444444-4444-4444-8444-444444444444'
const RULESET_FRAGMENT_ID = '55555555-5555-4555-8555-555555555555'
const CONTEXT_ID = '66666666-6666-4666-8666-666666666666'
const PROFILE_ID = '77777777-7777-4777-8777-777777777777'
const CONNECTION_ID = '88888888-8888-4888-8888-888888888888'
const SOURCE_ID = '99999999-9999-4999-8999-999999999999'
const hash = 'a'.repeat(64)
const now = new Date('2026-09-05T12:00:00.000Z')

const envelope = {
  schemaVersion: 'v2' as const,
  envelopeVersion: '1' as const,
  prompt: {
    templateId: 'bill-analysis' as const,
    templateVersion: '2' as const,
    templateHash: hash,
  },
  context: {
    collectionContextRevisionId: CONTEXT_ID,
    revision: 2,
    purpose: 'personal_expenses' as const,
    period: { startDate: '2026-01-01', endDate: '2026-12-31' },
    notes: 'private notes',
  },
  taxpayerProfile: {
    revisionId: PROFILE_ID,
    revision: 1,
    hasRuc: false,
    hasEmploymentIncome: true,
    taxRegime: 'unknown' as const,
    vatFilingFrequency: 'none' as const,
    additionalFacts: 'additional private facts',
  },
  activities: [],
  provider: {
    id: CONNECTION_ID,
    provider: 'OPENAI' as const,
    modelId: 'gpt-4o-mini',
  },
  ruleset: {
    id: RULESET_FRAGMENT_ID,
    version: 1,
    contentHash: hash,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
  },
  officialEvidence: [
    {
      ruleSetFragmentId: RULESET_FRAGMENT_ID,
      fragmentId: FRAGMENT_ID,
      fragmentContentHash: hash,
      source: {
        id: SOURCE_ID,
        title: 'Resolución de prueba',
        issuer: 'SRI',
        officialUrl: 'https://www.sri.gob.ec/',
        contentHash: hash,
      },
      articleOrSection: 'Art. 1',
      purposes: ['personal_expenses'],
      taxRegimes: ['unknown'],
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      markdown: 'official markdown that must remain private',
    },
  ],
  invoices: [
    {
      billId: INVOICE_ID,
      contentHash: hash,
      parserVersion: 'xml-v1' as const,
      normalized: {
        vendorName: 'Proveedor',
        buyerIdentifier: '1314708916',
        buyerName: 'Nombre privado',
        details: [
          { description: 'Detalle privado', quantity: 1, unitPrice: 10 },
        ],
        totals: { amount: 11.5, net: 10, taxes: 1.5 },
        billType: 'PERSONAL' as const,
      },
    },
  ],
}

const result = normalizeTaxAnalysisResult({
  payload: {
    purpose: 'personal_expenses',
    classification: 'eligible',
    reasoning: 'La categoría aplica.',
    uncertainties: [],
    personalExpenseCategory: 'Salud',
    potentialEligibleAmount: 11.5,
    missingEvidence: [],
  },
  purpose: 'personal_expenses',
  runId: RUN_ID,
  invoiceId: INVOICE_ID,
  allowedActivityRevisionIds: [ACTIVITY_ID],
  references: {
    official: [
      {
        sourceId: SOURCE_ID,
        sourceContentHash: hash,
        fragmentId: FRAGMENT_ID,
        fragmentContentHash: hash,
        articleOrSection: 'Art. 1',
      },
    ],
  },
  createdAt: now,
})

const row = {
  id: RUN_ID,
  status: 'completed',
  blockCode: null,
  blockMessage: null,
  provider: 'OPENAI',
  modelId: 'gpt-4o-mini',
  promptVersion: '2',
  inputSnapshot: envelope,
  createdAt: now,
  completedAt: now,
  _count: { invoices: 1 },
  results: [
    {
      billId: INVOICE_ID,
      purpose: 'personal_expenses',
      classification: 'eligible',
      resultSnapshot: { ...result, createdAt: result.createdAt.toISOString() },
      createdAt: now,
    },
  ],
}

describe('analysis run history projection', () => {
  it('returns a specialized, validated result without exposing raw snapshots or internal identifiers', () => {
    const detail = projectAnalysisRunDetail(row)
    expect(detail.results[0]).toMatchObject({
      status: 'available',
      result: {
        purpose: 'personal_expenses',
        personalExpenseCategory: 'Salud',
      },
    })
    expect(detail.frozenContext).toMatchObject({
      status: 'available',
      context: { purpose: 'personal_expenses' },
    })
    expect(detail.period).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    })
    const serialized = JSON.stringify(detail)
    expect(serialized).not.toContain('private notes')
    expect(serialized).not.toContain('additional private facts')
    expect(serialized).not.toContain('official markdown')
    expect(serialized).not.toContain('private user reference markdown')
    expect(serialized).not.toContain('1314708916')
    expect(serialized).not.toContain('Detalle privado')
    expect(serialized).not.toContain(INVOICE_ID)
    expect(serialized).not.toContain(ACTIVITY_ID)
    expect(serialized).not.toContain(SOURCE_ID)
    expect(serialized).not.toContain(hash)
    expect(serialized).not.toContain('"percentage":')
    expect(serialized).not.toContain('"reason":')
  })

  it('returns a stable unavailable state for malformed snapshots', () => {
    const item = projectAnalysisRunHistoryItem({
      ...row,
      inputSnapshot: { unexpected: 'raw snapshot must not escape' },
      results: [{ ...row.results[0], resultSnapshot: { invalid: true } }],
    })
    expect(item.snapshotStatus).toBe('unavailable')
    expect(item.results[0]).toMatchObject({ status: 'unavailable' })
    expect(JSON.stringify(item)).not.toContain('raw snapshot must not escape')
  })

  it('keeps a blocked run explainable without revealing its JSON snapshot', () => {
    const detail = projectAnalysisRunDetail({
      ...row,
      status: 'blocked',
      blockCode: 'MISSING_APPLICABLE_RULESET',
      inputSnapshot: {
        schemaVersion: 'v2',
        blockCode: 'MISSING_APPLICABLE_RULESET',
        secret: 'never return this',
      },
      results: [],
    })
    expect(detail.frozenContext).toEqual({
      status: 'blocked',
      blockCode: 'MISSING_APPLICABLE_RULESET',
    })
    expect(JSON.stringify(detail)).not.toContain('never return this')
  })
})

describe('analysis history router boundaries', () => {
  const router = readFileSync(
    resolve(
      process.cwd(),
      'apps/web/src/integrations/trpc/procedures/collections/index.ts',
    ),
    'utf8',
  )

  it('uses owner and archived-collection guards before list and detail queries', () => {
    expect(router).toContain('listAnalysisRunHistory: privateProcedure')
    expect(router).toContain('getAnalysisRunDetail: privateProcedure')
    expect(router.match(/deletedAt: null/g)?.length).toBeGreaterThanOrEqual(8)
    expect(router).toContain('userId: ctx.principal.userId')
  })

  it('orders pages and result rows deterministically without returning raw snapshots', () => {
    expect(router).toContain("orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]")
    expect(router).toContain(
      "orderBy: [{ createdAt: 'asc' }, { billId: 'asc' }]",
    )
    expect(router).toContain('projectAnalysisRunHistoryItem')
    expect(router).toContain('projectAnalysisRunDetail')
  })
})
