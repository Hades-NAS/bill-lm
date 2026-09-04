import { describe, expect, it } from 'vitest'

import { selectApplicableTaxRuleSet } from '../selector'

describe('selectApplicableTaxRuleSet', () => {
  it('selects only an active ruleset matching facts and full period', () => {
    const selector = { purpose: 'vat_credit' as const, period: { startDate: '2026-01-01', endDate: '2026-01-31' }, taxRegime: 'general' as const, vatFilingFrequency: 'monthly' as const }
    expect(selectApplicableTaxRuleSet(selector, [
      { id: 'draft', ...selector, effectiveFrom: '2025-01-01', effectiveTo: null, reviewStatus: 'draft' },
      { id: 'active', ...selector, effectiveFrom: '2026-01-01', effectiveTo: null, reviewStatus: 'active' },
    ])?.id).toBe('active')
  })
})
