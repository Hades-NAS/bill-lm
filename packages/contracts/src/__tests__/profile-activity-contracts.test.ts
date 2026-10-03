import { describe, expect, it } from 'vitest'

import {
  CollectionContextRevisionInputSchema,
  EconomicActivityRevisionInputSchema,
  EconomicActivityRevisionSchema,
  LocalCollectionDetailSchema,
  LocalCollectionInvoiceMembershipSchema,
  TaxpayerProfileRevisionDataSchema,
  TaxpayerProfileRevisionInputSchema,
} from '../index'

const id = '1ee4824c-8fc4-42cf-8d02-e963a78d16d8'

describe('profile and activity contracts', () => {
  it('preserves activity IVA-treatment validation and Spanish feedback', () => {
    const result = EconomicActivityRevisionInputSchema.safeParse({
      displayName: 'Diseño',
      registeredActivityName: 'Servicios de diseño',
      activityDescription: 'Diseño gráfico para clientes.',
      revenueVatTreatment: 'other',
    })

    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['revenueVatTreatmentOther'],
          message: 'Describe el tratamiento de IVA cuando seleccionas “otro”.',
        }),
      )
  })

  it('keeps empty optional identification values valid', () => {
    expect(
      TaxpayerProfileRevisionDataSchema.safeParse({
        displayName: 'Asalariado',
        personalIdNumber: '',
        professionalIdNumber: '',
        hasEmploymentIncome: true,
        hasRuc: false,
        taxRegime: 'unknown',
        vatFilingFrequency: 'none',
      }).success,
    ).toBe(true)
  })

  it('rejects activities for profiles without RUC', () => {
    const result = TaxpayerProfileRevisionInputSchema.safeParse({
      displayName: 'Inconsistente',
      hasEmploymentIncome: false,
      hasRuc: false,
      taxRegime: 'unknown',
      vatFilingFrequency: 'none',
      activityRevisionIds: [id],
    })

    expect(result.success).toBe(false)
    if (!result.success)
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          path: ['activityRevisionIds'],
          message: 'Un perfil sin RUC no puede incluir actividades económicas.',
        }),
      )
  })

  it('uses civil-date strings for periods and Date instances for revisions', () => {
    expect(
      CollectionContextRevisionInputSchema.safeParse({
        purpose: 'vat_credit',
        period: { startDate: '2026-01-01', endDate: '2026-01-31' },
        taxpayerProfileRevisionId: id,
        activityRevisionIds: [id],
      }).success,
    ).toBe(true)
    expect(
      CollectionContextRevisionInputSchema.safeParse({
        purpose: 'vat_credit',
        period: { startDate: new Date(), endDate: '2026-01-31' },
        taxpayerProfileRevisionId: id,
        activityRevisionIds: [id],
      }).success,
    ).toBe(false)
    expect(
      EconomicActivityRevisionSchema.safeParse({
        id,
        activityId: id,
        revision: 1,
        createdAt: new Date(),
        displayName: 'Diseño',
        registeredActivityName: 'Servicios de diseño',
        activityDescription: 'Diseño gráfico para clientes.',
        revenueVatTreatment: 'taxed_nonzero',
      }).success,
    ).toBe(true)
  })

  it('defines serializable collection membership and aggregate detail responses', () => {
    expect(LocalCollectionInvoiceMembershipSchema.parse({ kind: 'attached' }))
      .toEqual({ kind: 'attached' })
    expect(LocalCollectionDetailSchema.parse({
      id,
      latestRevision: null,
      name: 'Colección local',
      year: 2026,
      description: null,
      invoices: [{ id, fileName: 'factura.xml', createdAt: '2026-09-18T20:00:00.000Z', latestAnalysis: null }],
      runs: [{
        id, invoiceId: id, collectionId: id, collectionName: 'Colección local', fileName: 'factura.xml',
        status: 'completed', readAt: null, provider: null, apiFlavor: null, model: null,
        purpose: null, period: null, contextRevision: null, ruleset: null, error: null, progress: null, eventCount: 1,
        timing: { createdAt: '2026-09-18T20:00:00.000Z', startedAt: null, terminalAt: null, durationMs: null },
      }],
    })).toMatchObject({ id, invoices: [{ id }], runs: [{ collectionId: id }] })
  })
})
