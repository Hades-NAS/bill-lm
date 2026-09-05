import { describe, expect, it } from 'vitest'

import {
  BILL_ANALYSIS_V2_PROMPT_METADATA,
  BillPromptBuilder,
} from '../bill-prompt-builder'
import {
  AnalysisExecutionEnvelopeV2Schema,
  ModelTaxAnalysisPayloadV2Schema,
  type TaxPurpose,
} from '#/schema/tax-analysis-v2'

const id = '1ee4824c-8fc4-42cf-8d02-e963a78d16d8'

function createEnvelope(purpose: TaxPurpose) {
  return AnalysisExecutionEnvelopeV2Schema.parse({
    schemaVersion: 'v2',
    envelopeVersion: '1',
    prompt: BILL_ANALYSIS_V2_PROMPT_METADATA,
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
    activities: [{
      revisionId: id,
      revision: 1,
      displayName: 'Desarrollo de software',
      registeredActivityCode: '620100',
      registeredActivityName: 'Servicios de programación',
      activityDescription: 'Desarrollo para clientes.',
      necessaryPurchases: 'Servicios de nube.',
      revenueVatTreatment: 'taxed_nonzero',
      additionalFacts: null,
    }],
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
    userReferences: [{
      id,
      name: 'Nota del contribuyente.md',
      normalizedMarkdown: 'Material autogestionado.',
      contentHash: 'reference-hash',
    }],
    invoices: [{
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
    }],
  })
}

describe('BillPromptBuilder', () => {
  it('labels user references as self-managed rather than official rules', () => {
    const prompt = new BillPromptBuilder().build(
      {
        jobId: 'job-id',
        userId: 'user-id',
        credentialId: 'connection-id',
        percentage: 0,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        callCount: 0,
        totalTokens: 0,
        deletedAt: null,
        read: false,
        data: {
          collectionId: 'collection-id',
          collectionName: 'Colección',
          type: 'all',
          billIds: ['bill-id'],
          credentialId: 'connection-id',
        },
      },
      {
        vendorName: 'Proveedor',
        buyerIdentifier: '0102030405',
        details: [],
        totals: { amount: 1, net: 1, taxes: 0 },
        billType: 'PERSONAL',
      },
      [{ name: 'Mi criterio.md', markdown: '# Mi criterio\n\nSolo mi texto.' }],
    )

    expect(prompt).toContain('Mi criterio.md')
    expect(prompt).toContain('autogestionado')
    expect(prompt).toContain('no es una fuente oficial')
  })

  it('labels published ruleset sections as official and keeps them distinct from user material', () => {
    const prompt = new BillPromptBuilder().build(
      {
        jobId: 'job-id',
        userId: 'user-id',
        credentialId: 'connection-id',
        percentage: 0,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        callCount: 0,
        totalTokens: 0,
        deletedAt: null,
        read: false,
        data: {
          collectionId: 'collection-id',
          collectionName: 'Colección',
          type: 'all',
          billIds: ['bill-id'],
          credentialId: 'connection-id',
        },
      },
      {
        vendorName: 'Proveedor',
        buyerIdentifier: '0102030405',
        details: [],
        totals: { amount: 1, net: 1, taxes: 0 },
        billType: 'PERSONAL',
      },
      [{ name: 'Nota propia.md', markdown: 'Nota del usuario.' }],
      [{ name: 'SRI — LRTI · Art. 10', markdown: 'Texto oficial publicado.' }],
    )

    expect(prompt).toContain('Secciones de fuente oficial publicadas')
    expect(prompt).toContain('SRI — LRTI · Art. 10')
    expect(prompt).toContain('Nota propia.md')
  })

  it.each([
    ['vat_credit', 'crédito tributario de IVA'],
    ['business_income_tax', 'impuesto a la renta de negocio'],
    ['personal_expenses', 'gastos personales'],
  ] as const)(
    'builds a deterministic V2 prompt for %s',
    (purpose, purposeInstruction) => {
      const envelope = createEnvelope(purpose)
      const builder = new BillPromptBuilder()

      const prompt = builder.buildV2(envelope, id)

      expect(prompt).toContain('Contexto fijado')
      expect(prompt).toContain(purposeInstruction)
      expect(prompt).toContain('"purpose": "' + purpose + '"')
      expect(prompt).toContain('Norma A')
      expect(prompt).toContain('Nota del contribuyente.md')
      expect(prompt).toContain(BILL_ANALYSIS_V2_PROMPT_METADATA.templateHash)
      expect(builder.buildV2(envelope, id)).toBe(prompt)
    },
  )

  it('keeps frozen evidence ordering and omits private invoice identifiers', () => {
    const prompt = new BillPromptBuilder().buildV2(
      createEnvelope('business_income_tax'),
      id,
    )

    expect(prompt.indexOf('Primera evidencia oficial.')).toBeLessThan(
      prompt.indexOf('Segunda evidencia oficial.'),
    )
    expect(prompt).toContain('material autogestionado')
    expect(prompt).not.toContain('buyerIdentifier')
    expect(prompt).not.toContain('0102030405')
    expect(prompt).not.toContain('Persona privada')
    expect(prompt).not.toContain('rawXml')
  })

  it('rejects extra fields in the model-owned V2 payload', () => {
    expect(ModelTaxAnalysisPayloadV2Schema.safeParse({
      purpose: 'personal_expenses',
      classification: 'needs_review',
      reasoning: 'Falta confirmar el beneficiario.',
      uncertainties: ['No consta la relación con el beneficiario.'],
      missingEvidence: ['Relación con el beneficiario.'],
      runId: id,
    }).success).toBe(false)

    expect(ModelTaxAnalysisPayloadV2Schema.safeParse({
      purpose: 'vat_credit',
      classification: 'eligible',
      reasoning: 'La factura contiene IVA.',
      uncertainties: [],
      relatedActivityRevisionIds: [id],
      invoiceVatAmount: 1.5,
      creditType: 'total',
      proportionalityRequired: false,
      missingEvidence: [],
    }).success).toBe(true)
  })

  it('uses stable non-secret template metadata in the frozen envelope', () => {
    const first = createEnvelope('vat_credit').prompt
    const second = createEnvelope('vat_credit').prompt

    expect(first).toEqual(BILL_ANALYSIS_V2_PROMPT_METADATA)
    expect(second).toEqual(first)
    expect(first.templateHash).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(first)).not.toMatch(/apiKey|secret|ciphertext/i)
  })
})
