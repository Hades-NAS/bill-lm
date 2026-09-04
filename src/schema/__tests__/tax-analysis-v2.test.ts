import { describe, expect, it } from 'vitest'

import {
  AnalysisBlockSchema,
  CollectionContextRevisionInputSchema,
  EconomicActivityRevisionInputSchema,
  TAX_ANALYSIS_SCHEMA_VERSION,
  TaxAnalysisResultV2Schema,
  TaxpayerProfileRevisionInputSchema,
} from '../tax-analysis-v2'

const id = '1ee4824c-8fc4-42cf-8d02-e963a78d16d8'

describe('tax analysis v2 contracts', () => {
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
    expect(TaxpayerProfileRevisionInputSchema.safeParse({
      displayName: 'Relación de dependencia',
      hasEmploymentIncome: true,
      hasRuc: false,
      taxRegime: 'unknown',
      vatFilingFrequency: 'none',
      activityRevisionIds: [],
    }).success).toBe(true)
    expect(TaxpayerProfileRevisionInputSchema.safeParse({
      displayName: 'Inconsistente',
      hasEmploymentIncome: false,
      hasRuc: false,
      taxRegime: 'unknown',
      vatFilingFrequency: 'monthly',
      activityRevisionIds: [id],
    }).success).toBe(false)
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
      TaxAnalysisResultV2Schema.safeParse({
        schemaVersion: TAX_ANALYSIS_SCHEMA_VERSION,
        runId: id,
        invoiceId: id,
        purpose: 'personal_expenses',
        classification: 'needs_review',
        reasoning: 'El contexto disponible no permite confirmar el caso.',
        uncertainties: ['Falta evidencia adicional.'],
        missingEvidence: ['No se conoce el beneficiario.'],
        createdAt: new Date(),
      }).success,
    ).toBe(true)
  })
})
