import { describe, expect, it } from 'vitest'

import {
  createEconomicActivityRevision,
  createTaxpayerProfileRevision,
} from '../src/index'

const id = '1ee4824c-8fc4-42cf-8d02-e963a78d16d8'

describe('immutable economic activity revisions', () => {
  it('preserves a valid revision as an immutable snapshot', () => {
    const result = createEconomicActivityRevision({
      id,
      activityId: id,
      revision: 1,
      createdAt: '2026-09-12T19:00:00.000Z',
      displayName: 'Diseño',
      registeredActivityName: 'Servicios de diseño',
      activityDescription: 'Diseño gráfico para clientes.',
      revenueVatTreatment: 'taxed_nonzero',
    })
    expect(result).toMatchObject({ ok: true })
    if (result.ok) expect(Object.isFrozen(result.value)).toBe(true)
  })

  it('requires a description for the other IVA treatment', () => {
    const result = createEconomicActivityRevision({
      id,
      activityId: id,
      revision: 1,
      createdAt: '2026-09-12T19:00:00.000Z',
      displayName: 'Diseño',
      registeredActivityName: 'Servicios de diseño',
      activityDescription: 'Diseño gráfico para clientes.',
      revenueVatTreatment: 'other',
    })
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'economic_activity.revenue_vat_treatment_other_required',
        message: 'Describe el tratamiento de IVA cuando seleccionas “otro”.',
      },
    })
  })
})

describe('immutable taxpayer profile revisions', () => {
  it('copies and freezes selected activity revision IDs', () => {
    const activityRevisionIds = [id]
    const result = createTaxpayerProfileRevision({
      id,
      taxpayerProfileId: id,
      revision: 1,
      createdAt: '2026-09-12T19:00:00.000Z',
      displayName: 'Profesional',
      hasEmploymentIncome: false,
      hasRuc: true,
      taxRegime: 'general',
      vatFilingFrequency: 'monthly',
      activityRevisionIds,
    })
    activityRevisionIds.push('another-id')
    expect(result).toMatchObject({ ok: true })
    if (result.ok) {
      expect(result.value.activityRevisionIds).toEqual([id])
      expect(Object.isFrozen(result.value.activityRevisionIds)).toBe(true)
    }
  })

  it('rejects the existing no-RUC cross-field inconsistencies', () => {
    const vatResult = createTaxpayerProfileRevision({
      id,
      taxpayerProfileId: id,
      revision: 1,
      createdAt: '2026-09-12T19:00:00.000Z',
      displayName: 'Asalariado',
      hasEmploymentIncome: true,
      hasRuc: false,
      taxRegime: 'unknown',
      vatFilingFrequency: 'monthly',
      activityRevisionIds: [],
    })
    const activitiesResult = createTaxpayerProfileRevision({
      id,
      taxpayerProfileId: id,
      revision: 1,
      createdAt: '2026-09-12T19:00:00.000Z',
      displayName: 'Asalariado',
      hasEmploymentIncome: true,
      hasRuc: false,
      taxRegime: 'unknown',
      vatFilingFrequency: 'none',
      activityRevisionIds: [id],
    })
    expect(vatResult).toMatchObject({
      ok: false,
      error: { code: 'taxpayer_profile.no_ruc_requires_no_vat_filing' },
    })
    expect(activitiesResult).toMatchObject({
      ok: false,
      error: { code: 'taxpayer_profile.no_ruc_cannot_have_activities' },
    })
  })

  it('rejects non-positive revision numbers without throwing', () => {
    const result = createTaxpayerProfileRevision({
      id,
      taxpayerProfileId: id,
      revision: 0,
      createdAt: '2026-09-12T19:00:00.000Z',
      displayName: 'Asalariado',
      hasEmploymentIncome: true,
      hasRuc: false,
      taxRegime: 'unknown',
      vatFilingFrequency: 'none',
      activityRevisionIds: [],
    })
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'revision.must_be_positive' },
    })
  })
})
