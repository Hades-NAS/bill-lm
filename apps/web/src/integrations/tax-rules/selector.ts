import { TaxRuleSetSelectorSchema } from '#/schema/tax-analysis'

import type { TaxRuleSetSelector } from '#/schema/tax-analysis'

export type SelectableTaxRuleSet = Omit<TaxRuleSetSelector, 'period'> & {
  id: string
  version: number
  effectiveFrom: string
  effectiveTo: string | null
  reviewStatus: 'draft' | 'reviewed' | 'active' | 'retired'
}

export function selectApplicableTaxRuleSet(
  selector: TaxRuleSetSelector,
  candidates: Array<SelectableTaxRuleSet>,
) {
  const parsed = TaxRuleSetSelectorSchema.parse(selector)
  return (
    candidates
      .filter(
        (candidate) =>
          candidate.reviewStatus === 'active' &&
          candidate.purpose === parsed.purpose &&
          candidate.taxRegime === parsed.taxRegime &&
          candidate.vatFilingFrequency === parsed.vatFilingFrequency &&
          candidate.effectiveFrom <= parsed.period.startDate &&
          (!candidate.effectiveTo ||
            candidate.effectiveTo >= parsed.period.endDate),
      )
      .sort(
        (left, right) =>
          right.effectiveFrom.localeCompare(left.effectiveFrom) ||
          right.version - left.version ||
          left.id.localeCompare(right.id),
      )[0] ?? null
  )
}
