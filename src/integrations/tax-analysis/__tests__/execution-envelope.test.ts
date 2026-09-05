import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  AnalysisExecutionEnvelopeBudgetError,
  assertExecutionEnvelopeBudget,
  selectApplicableOfficialEvidence,
} from '../execution-envelope.server'
import {
  AnalysisPrerequisiteError,
  assertAnalysisEnvelopeCanExecute,
  assertFrozenProviderConnection,
} from '../analysis-gate'

const envelope = {
  schemaVersion: 'v2' as const,
  envelopeVersion: '1' as const,
  officialEvidence: [{ markdown: 'oficial' }],
  userReferences: [{ normalizedMarkdown: 'usuario' }],
} as any

describe('execution envelope budget', () => {
  it('does not silently truncate evidence within budget', () => {
    expect(assertExecutionEnvelopeBudget(envelope, 20)).toBe(14)
  })

  it('blocks instead of truncating evidence above budget', () => {
    expect(() => assertExecutionEnvelopeBudget(envelope, 12)).toThrow(
      AnalysisExecutionEnvelopeBudgetError,
    )
  })

  it('keeps only evidence applicable to purpose, regime and the full period', () => {
    const selector = {
      purpose: 'vat_credit' as const,
      taxRegime: 'general' as const,
      vatFilingFrequency: 'monthly' as const,
      period: { startDate: '2026-01-01', endDate: '2026-01-31' },
    }
    const candidate = (id: string, overrides = {}) => ({
      ruleSetFragmentId: '550e8400-e29b-41d4-a716-446655440000',
      fragmentId: id,
      fragmentContentHash: 'fragment',
      source: { id: 'source-a', title: 'Norma', issuer: 'SRI', officialUrl: 'https://www.sri.gob.ec/', contentHash: 'source' },
      articleOrSection: id,
      purposes: ['vat_credit'],
      taxRegimes: ['general'],
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      markdown: `# ${id}`,
      ...overrides,
    })
    expect(selectApplicableOfficialEvidence(selector, [
      candidate('valid'),
      candidate('wrong-purpose', { purposes: ['personal_expenses'] }),
      candidate('wrong-regime', { taxRegimes: ['rimpe_entrepreneur'] }),
      candidate('expired', { effectiveTo: '2026-01-15' }),
    ] as any).map((item) => item.fragmentId)).toEqual(['valid'])
  })

  it('does not add secret or raw-file fields to a persisted envelope contract', () => {
    const serialized = JSON.stringify(envelope)
    expect(serialized).not.toMatch(/apiKey|ciphertext|secret|<factura|%PDF/i)
  })

  it('keeps the worker independent from live reference, ruleset and object reads', () => {
    const worker = readFileSync(
      resolve(process.cwd(), 'src/integrations/jobs/analyze-job.ts'),
      'utf8',
    )
    expect(worker).not.toContain('loadActiveFiscalReferenceContext')
    expect(worker).not.toContain('StorageHelper')
    expect(worker).not.toContain('taxRuleSet.find')
    expect(worker).toContain('parseAnalysisExecutionEnvelope')
  })
})

describe('analysis execution gate', () => {
  const validEnvelope = () => ({
    context: {
      purpose: 'personal_expenses' as const,
      period: { startDate: '2026-01-01', endDate: '2026-12-31' },
      notes: null,
    },
    taxpayerProfile: {
      revisionId: '550e8400-e29b-41d4-a716-446655440000',
      hasRuc: false,
      taxRegime: 'unknown' as const,
      vatFilingFrequency: 'none' as const,
    },
    activities: [],
    officialEvidence: [{
      ruleSetFragmentId: '550e8400-e29b-41d4-a716-446655440000',
      fragmentId: '550e8400-e29b-41d4-a716-446655440000',
      fragmentContentHash: 'fragment',
      source: { id: 'source-a', title: 'Norma', issuer: 'SRI', officialUrl: 'https://www.sri.gob.ec/', contentHash: 'source' },
      articleOrSection: 'Art. 1',
      purposes: ['personal_expenses'],
      taxRegimes: ['unknown'],
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      markdown: 'Contenido oficial',
    }],
    userReferences: [],
    invoices: [{ billId: '550e8400-e29b-41d4-a716-446655440000' }],
    provider: { id: 'connection-1', provider: 'OPENAI' as const, modelId: 'gpt-4o-mini' },
  })

  it('permits a prepared envelope only when its immutable prerequisites remain valid', () => {
    expect(() => assertAnalysisEnvelopeCanExecute(validEnvelope() as any)).not.toThrow()
  })

  it('blocks before a provider can run when evidence or purpose prerequisites are invalid', () => {
    const noEvidence = validEnvelope()
    noEvidence.officialEvidence = []
    expect(() => assertAnalysisEnvelopeCanExecute(noEvidence as any)).toThrow(
      AnalysisPrerequisiteError,
    )
    expect(() => assertAnalysisEnvelopeCanExecute(noEvidence as any)).toThrow(
      'evidencia oficial aplicable',
    )

    const missingActivities = validEnvelope()
    ;(missingActivities.context as { purpose: string }).purpose = 'business_income_tax'
    expect(() => assertAnalysisEnvelopeCanExecute(missingActivities as any)).toThrow(
      'Selecciona al menos una actividad económica',
    )
  })

  it('rejects an inactive or changed provider connection before decryption', () => {
    const execution = validEnvelope()
    expect(() => assertFrozenProviderConnection(execution as any, null)).toThrow(
      'ya no está activa',
    )
    expect(() => assertFrozenProviderConnection(execution as any, {
      id: 'connection-1', provider: 'OPENAI', modelId: 'other-model',
    })).toThrow('cambió después de preparar')
  })

  it('claims queued runs atomically before decrypting a provider secret', () => {
    const worker = readFileSync(
      resolve(process.cwd(), 'src/integrations/jobs/analyze-job.ts'),
      'utf8',
    )
    expect(worker).toContain("status: 'queued'")
    expect(worker).toContain('claim.count !== 1')
    expect(worker.indexOf('claim.count !== 1')).toBeLessThan(
      worker.lastIndexOf('decryptProviderSecret'),
    )
  })
})
