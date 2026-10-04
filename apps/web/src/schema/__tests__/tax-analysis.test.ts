import { describe, expect, it } from 'vitest'

import { ModelTaxAnalysisPayloadSchema as SharedModelTaxAnalysisPayloadSchema } from '@bill-lm/contracts'

import {
  AnalysisBlockSchema,
  AnalysisExecutionEnvelopeSchema,
  CollectionContextRevisionInputSchema,
  collectionContextBlocks,
  EconomicActivityRevisionInputSchema,
  ModelTaxAnalysisPayloadSchema,
  TAX_ANALYSIS_SCHEMA_VERSION,
  TaxAnalysisResultSchema,
  TaxpayerProfileRevisionInputSchema,
  TaxpayerProfileRevisionDataSchema,
} from '../tax-analysis'

const id = '1ee4824c-8fc4-42cf-8d02-e963a78d16d8'

describe('tax analysis contracts', () => {
  it('uses the exact shared model-output schema consumed by the local daemon', () => {
    expect(ModelTaxAnalysisPayloadSchema).toBe(
      SharedModelTaxAnalysisPayloadSchema,
    )
  })

  it('accepts only executable purposes and an ordered civil period', () => {
    expect(
      CollectionContextRevisionInputSchema.safeParse({
        purpose: 'vat_credit',
        period: { startDate: '2026-01-01', endDate: '2026-12-31' },
        taxpayerProfileRevisionId: id,
        activityRevisionIds: [id],
      }).success,
    ).toBe(true)

    expect(
      CollectionContextRevisionInputSchema.safeParse({
        purpose: 'other',
        period: { startDate: '2026-12-31', endDate: '2026-01-01' },
        taxpayerProfileRevisionId: id,
        activityRevisionIds: [id],
      }).success,
    ).toBe(false)
  })

  it('requires an explanation when IVA treatment is other', () => {
    expect(
      EconomicActivityRevisionInputSchema.safeParse({
        displayName: 'Diseño',
        registeredActivityName: 'Servicios de diseño',
        activityDescription: 'Diseño gráfico para clientes.',
        revenueVatTreatment: 'other',
      }).success,
    ).toBe(false)
  })

  it('allows an employee profile without activities and rejects activities without RUC', () => {
    expect(
      TaxpayerProfileRevisionInputSchema.safeParse({
        displayName: 'Relación de dependencia',
        hasEmploymentIncome: true,
        hasRuc: false,
        taxRegime: 'unknown',
        vatFilingFrequency: 'none',
        activityRevisionIds: [],
      }).success,
    ).toBe(true)
    expect(
      TaxpayerProfileRevisionInputSchema.safeParse({
        displayName: 'Inconsistente',
        hasEmploymentIncome: false,
        hasRuc: false,
        taxRegime: 'unknown',
        vatFilingFrequency: 'monthly',
        activityRevisionIds: [id],
      }).success,
    ).toBe(false)
  })

  it('validates the profile data step independently from activity selection', () => {
    expect(
      TaxpayerProfileRevisionDataSchema.safeParse({
        displayName: 'Asalariado',
        personalIdNumber: '0102030405',
        professionalIdNumber: '',
        hasEmploymentIncome: true,
        hasRuc: false,
        taxRegime: 'unknown',
        vatFilingFrequency: 'none',
        activityRevisionIds: ['550e8400-e29b-41d4-a716-446655440000'],
        additionalFacts: '',
      }).success,
    ).toBe(true)
  })

  it('blocks IVA until the profile and activity facts are resolved', () => {
    const context = CollectionContextRevisionInputSchema.parse({
      purpose: 'vat_credit',
      period: { startDate: '2026-01-01', endDate: '2026-01-31' },
      taxpayerProfileRevisionId: id,
      activityRevisionIds: [],
    })
    expect(
      collectionContextBlocks(context, {
        hasRuc: false,
        taxRegime: 'unknown',
        vatFilingFrequency: 'unknown',
      }).map((block) => block.code),
    ).toEqual([
      'MISSING_TAXPAYER_PROFILE',
      'MISSING_ECONOMIC_ACTIVITY',
      'UNRESOLVED_TAX_REGIME',
      'UNRESOLVED_VAT_FREQUENCY',
    ])
  })

  it('allows personal expenses without activities but requires activities for IVA and IR business', () => {
    const base = {
      period: { startDate: '2026-01-01', endDate: '2026-12-31' },
      taxpayerProfileRevisionId: id,
      activityRevisionIds: [],
    }
    const profile = {
      hasRuc: true,
      taxRegime: 'general' as const,
      vatFilingFrequency: 'monthly' as const,
    }
    expect(
      collectionContextBlocks(
        CollectionContextRevisionInputSchema.parse({
          ...base,
          purpose: 'personal_expenses',
        }),
        profile,
      ),
    ).toEqual([])
    expect(
      collectionContextBlocks(
        CollectionContextRevisionInputSchema.parse({
          ...base,
          purpose: 'vat_credit',
        }),
        profile,
      ).map((block) => block.code),
    ).toContain('MISSING_ECONOMIC_ACTIVITY')
    expect(
      collectionContextBlocks(
        CollectionContextRevisionInputSchema.parse({
          ...base,
          purpose: 'business_income_tax',
        }),
        profile,
      ).map((block) => block.code),
    ).toContain('MISSING_ECONOMIC_ACTIVITY')
  })

  it('keeps blocks actionable and results independently versioned', () => {
    expect(
      AnalysisBlockSchema.safeParse({
        code: 'MISSING_COLLECTION_CONTEXT',
        message: 'Completa el contexto de la colección antes de analizar.',
        actionLabel: 'Configurar colección',
        actionPath: '/collections/collection-id',
      }).success,
    ).toBe(true)

    expect(
      TaxAnalysisResultSchema.safeParse({
        schemaVersion: TAX_ANALYSIS_SCHEMA_VERSION,
        runId: id,
        invoiceId: id,
        purpose: 'personal_expenses',
        classification: 'needs_review',
        reasoning: 'El contexto disponible no permite confirmar el caso.',
        uncertainties: ['Falta evidencia adicional.'],
        advisoryNotice:
          'Resultado orientativo; no constituye un dictamen jurídico ni una determinación del SRI.',
        references: {
          official: [
            {
              sourceId: id,
              sourceContentHash: 'source',
              fragmentId: id,
              fragmentContentHash: 'fragment',
              articleOrSection: 'Art. 1',
            },
          ],
        },
        missingEvidence: ['No se conoce el beneficiario.'],
        createdAt: new Date(),
      }).success,
    ).toBe(true)
  })

  it('rejects raw XML in the immutable invoice envelope', () => {
    expect(
      AnalysisExecutionEnvelopeSchema.safeParse({
        schemaVersion: 'v2',
        envelopeVersion: '1',
        prompt: {
          templateId: 'bill-analysis',
          templateVersion: '2',
          templateHash: 'b'.repeat(64),
        },
        context: {
          collectionContextRevisionId: id,
          revision: 1,
          purpose: 'personal_expenses',
          period: { startDate: '2026-01-01', endDate: '2026-12-31' },
          notes: null,
        },
        taxpayerProfile: {
          revisionId: id,
          revision: 1,
          hasRuc: false,
          hasEmploymentIncome: true,
          taxRegime: 'unknown',
          vatFilingFrequency: 'none',
          additionalFacts: null,
        },
        activities: [],
        provider: { id, provider: 'OPENAI', modelId: 'gpt-4o-mini' },
        ruleset: {
          id,
          version: 1,
          contentHash: 'rules',
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
        },
        officialEvidence: [
          {
            ruleSetFragmentId: id,
            fragmentId: id,
            fragmentContentHash: 'fragment',
            source: {
              id,
              title: 'Norma',
              issuer: 'SRI',
              officialUrl: 'https://www.sri.gob.ec/',
              contentHash: 'source',
            },
            articleOrSection: 'Art. 1',
            purposes: ['personal_expenses'],
            taxRegimes: ['unknown'],
            effectiveFrom: '2026-01-01',
            effectiveTo: null,
            markdown: 'Contenido',
          },
        ],
        invoices: [
          {
            billId: id,
            contentHash: 'a'.repeat(64),
            parserVersion: 'xml-v1',
            normalized: '<factura>secreto</factura>',
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('rejects retired self-managed references in an execution envelope', () => {
    expect(
      AnalysisExecutionEnvelopeSchema.safeParse({ userReferences: [] }).success,
    ).toBe(false)
  })
})
