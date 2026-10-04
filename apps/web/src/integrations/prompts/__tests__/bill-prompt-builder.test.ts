import { describe, expect, it } from 'vitest'

import {
  AnalysisExecutionEnvelopeSchema,
  ModelTaxAnalysisPayloadSchema,
} from '#/schema/tax-analysis'

import {
  BILL_ANALYSIS_PROMPT_METADATA,
  BillPromptBuilder,
} from '../bill-prompt-builder'

import type { TaxPurpose } from '#/schema/tax-analysis'

const id = '1ee4824c-8fc4-42cf-8d02-e963a78d16d8'

function createEnvelope(purpose: TaxPurpose) {
  return AnalysisExecutionEnvelopeSchema.parse({
    schemaVersion: 'v2',
    envelopeVersion: '1',
    prompt: BILL_ANALYSIS_PROMPT_METADATA,
    context: {
      collectionContextRevisionId: id,
      revision: 2,
      purpose,
      period: { startDate: '2026-01-01', endDate: '2026-01-31' },
      notes: 'Solo hechos confirmados.',
    },
    taxpayerProfile: {
      revisionId: id,
      revision: 3,
      hasRuc: true,
      hasEmploymentIncome: false,
      taxRegime: 'general',
      vatFilingFrequency: 'monthly',
      additionalFacts: null,
    },
    activities: [
      {
        revisionId: id,
        revision: 1,
        displayName: 'Desarrollo de software',
        registeredActivityCode: '620100',
        registeredActivityName: 'Servicios de programación',
        activityDescription: 'Desarrollo para clientes.',
        necessaryPurchases: 'Servicios de nube.',
        revenueVatTreatment: 'taxed_nonzero',
        additionalFacts: null,
      },
    ],
    provider: { id, provider: 'OPENAI', modelId: 'gpt-4o-mini' },
    ruleset: {
      id,
      version: 4,
      contentHash: 'ruleset-hash',
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
    },
    officialEvidence: [
      {
        ruleSetFragmentId: id,
        fragmentId: '2ee4824c-8fc4-42cf-8d02-e963a78d16d8',
        fragmentContentHash: 'fragment-a',
        source: {
          id,
          title: 'Norma A',
          issuer: 'SRI',
          officialUrl: 'https://www.sri.gob.ec/norma-a',
          contentHash: 'source-a',
        },
        articleOrSection: 'Art. 2',
        purposes: [purpose],
        taxRegimes: ['general'],
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
        markdown: 'Primera evidencia oficial.',
      },
      {
        ruleSetFragmentId: id,
        fragmentId: '3ee4824c-8fc4-42cf-8d02-e963a78d16d8',
        fragmentContentHash: 'fragment-b',
        source: {
          id,
          title: 'Norma B',
          issuer: 'SRI',
          officialUrl: 'https://www.sri.gob.ec/norma-b',
          contentHash: 'source-b',
        },
        articleOrSection: 'Art. 3',
        purposes: [purpose],
        taxRegimes: ['general'],
        effectiveFrom: '2026-01-01',
        effectiveTo: null,
        markdown: 'Segunda evidencia oficial.',
      },
    ],
    invoices: [
      {
        billId: id,
        contentHash: 'a'.repeat(64),
        parserVersion: 'xml-v1',
        normalized: {
          vendorName: 'Proveedor de nube',
          buyerIdentifier: '0102030405',
          buyerName: 'Persona privada',
          details: [{ description: 'Hosting', quantity: 1, unitPrice: 10 }],
          totals: { amount: 11.5, net: 10, taxes: 1.5 },
          billType: 'PROFESSIONAL',
        },
      },
    ],
  })
}

describe('BillPromptBuilder', () => {
  it.each([
    ['vat_credit', 'crédito tributario de IVA'],
    ['business_income_tax', 'impuesto a la renta de negocio'],
    ['personal_expenses', 'gastos personales'],
  ] as const)(
    'builds a deterministic prompt for %s',
    (purpose, purposeInstruction) => {
      const envelope = createEnvelope(purpose)
      const builder = new BillPromptBuilder()

      const prompt = builder.build(envelope, id)

      expect(prompt).toContain('Contexto fijado')
      expect(prompt).toContain(purposeInstruction)
      expect(prompt).toContain(
        'redacta en español todos los valores textuales visibles del JSON de salida',
      )
      expect(prompt).toContain('"purpose": "' + purpose + '"')
      expect(prompt).toContain('Norma A')
      expect(prompt).not.toContain('Material autogestionado')
      expect(prompt).toContain(BILL_ANALYSIS_PROMPT_METADATA.templateHash)
      expect(builder.build(envelope, id)).toBe(prompt)
    },
  )

  it('keeps frozen evidence ordering and omits private invoice identifiers', () => {
    const prompt = new BillPromptBuilder().build(
      createEnvelope('business_income_tax'),
      id,
    )

    expect(prompt.indexOf('Primera evidencia oficial.')).toBeLessThan(
      prompt.indexOf('Segunda evidencia oficial.'),
    )
    expect(prompt).not.toContain('material autogestionado')
    expect(prompt).not.toContain('buyerIdentifier')
    expect(prompt).not.toContain('0102030405')
    expect(prompt).not.toContain('Persona privada')
    expect(prompt).not.toContain('rawXml')
  })

  it('rejects extra fields in the model-owned payload', () => {
    expect(
      ModelTaxAnalysisPayloadSchema.safeParse({
        purpose: 'personal_expenses',
        classification: 'needs_review',
        reasoning: 'Falta confirmar el beneficiario.',
        uncertainties: ['No consta la relación con el beneficiario.'],
        missingEvidence: ['Relación con el beneficiario.'],
        runId: id,
      }).success,
    ).toBe(false)

    expect(
      ModelTaxAnalysisPayloadSchema.safeParse({
        purpose: 'vat_credit',
        classification: 'eligible',
        reasoning: 'La factura contiene IVA.',
        uncertainties: [],
        relatedActivityRevisionIds: [id],
        invoiceVatAmount: 1.5,
        creditType: 'total',
        proportionalityRequired: false,
        missingEvidence: [],
      }).success,
    ).toBe(true)
  })

  it('uses stable non-secret template metadata in the frozen envelope', () => {
    const first = createEnvelope('vat_credit').prompt
    const second = createEnvelope('vat_credit').prompt

    expect(first).toEqual(BILL_ANALYSIS_PROMPT_METADATA)
    expect(second).toEqual(first)
    expect(first.templateHash).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(first)).not.toMatch(/apiKey|secret|ciphertext/i)
  })
})
