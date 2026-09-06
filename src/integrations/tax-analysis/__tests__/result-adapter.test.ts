import { describe, expect, it } from 'vitest'

import {
  normalizeTaxAnalysisResult,
  TaxAnalysisResultValidationError,
} from '../result-adapter'

const RUN_ID = '11111111-1111-4111-8111-111111111111'
const INVOICE_ID = '22222222-2222-4222-8222-222222222222'
const ACTIVITY_ID = '33333333-3333-4333-8333-333333333333'
const references = {
  official: [
    {
      sourceId: RUN_ID,
      sourceContentHash: 'source-hash',
      fragmentId: INVOICE_ID,
      fragmentContentHash: 'fragment-hash',
      articleOrSection: 'Art. 1',
    },
  ],
}

describe('tax analysis result adapter', () => {
  it.each([
    [
      'IVA',
      'vat_credit',
      {
        purpose: 'vat_credit',
        classification: 'eligible',
        reasoning: 'Aplica.',
        uncertainties: [],
        relatedActivityRevisionIds: [ACTIVITY_ID],
        invoiceVatAmount: 12,
        potentialCreditableVatAmount: 12,
        creditablePercentage: 100,
        creditType: 'total',
        proportionalityRequired: false,
        missingEvidence: [],
      },
    ],
    [
      'IR de negocio',
      'business_income_tax',
      {
        purpose: 'business_income_tax',
        classification: 'needs_review',
        reasoning: 'Falta soporte.',
        uncertainties: ['Contrato'],
        relatedActivityRevisionIds: [ACTIVITY_ID],
        businessUsePercentage: 70,
        potentialExpenseAmount: 70,
        mixedUseDetected: true,
        substantiationIssues: ['Contrato'],
        missingEvidence: ['Contrato'],
      },
    ],
    [
      'gastos personales',
      'personal_expenses',
      {
        purpose: 'personal_expenses',
        classification: 'eligible',
        reasoning: 'Categoría permitida.',
        uncertainties: [],
        personalExpenseCategory: 'Salud',
        potentialEligibleAmount: 50,
        beneficiaryRelationship: 'Titular',
        missingEvidence: [],
      },
    ],
  ])('normaliza un resultado válido de %s', (_name, purpose, payload) => {
    const result = normalizeTaxAnalysisResult({
      payload,
      purpose: purpose as
        | 'vat_credit'
        | 'business_income_tax'
        | 'personal_expenses',
      runId: RUN_ID,
      invoiceId: INVOICE_ID,
      allowedActivityRevisionIds: [ACTIVITY_ID],
      references,
    })

    expect(result).toMatchObject({
      schemaVersion: 'v2',
      runId: RUN_ID,
      invoiceId: INVOICE_ID,
      purpose,
    })
    expect(result.references).toEqual(references)
    expect(result.advisoryNotice).toContain(
      'no constituye un dictamen jurídico',
    )
  })

  it('rechaza propósito cruzado, campos extra y actividades fuera del envelope', () => {
    expect(() =>
      normalizeTaxAnalysisResult({
        payload: {
          purpose: 'personal_expenses',
          classification: 'eligible',
          reasoning: 'x',
          uncertainties: [],
          missingEvidence: [],
        },
        purpose: 'vat_credit',
        runId: RUN_ID,
        invoiceId: INVOICE_ID,
        allowedActivityRevisionIds: [ACTIVITY_ID],
        references,
      }),
    ).toThrow(TaxAnalysisResultValidationError)

    expect(() =>
      normalizeTaxAnalysisResult({
        payload: {
          purpose: 'personal_expenses',
          classification: 'eligible',
          reasoning: 'x',
          uncertainties: [],
          missingEvidence: [],
          invented: true,
        },
        purpose: 'personal_expenses',
        runId: RUN_ID,
        invoiceId: INVOICE_ID,
        allowedActivityRevisionIds: [],
        references,
      }),
    ).toThrow(TaxAnalysisResultValidationError)

    expect(() =>
      normalizeTaxAnalysisResult({
        payload: {
          purpose: 'business_income_tax',
          classification: 'eligible',
          reasoning: 'x',
          uncertainties: [],
          relatedActivityRevisionIds: [INVOICE_ID],
          mixedUseDetected: false,
          substantiationIssues: [],
          missingEvidence: [],
        },
        purpose: 'business_income_tax',
        runId: RUN_ID,
        invoiceId: INVOICE_ID,
        allowedActivityRevisionIds: [ACTIVITY_ID],
        references,
      }),
    ).toThrow('no forma parte del contexto fijado')
  })
})
