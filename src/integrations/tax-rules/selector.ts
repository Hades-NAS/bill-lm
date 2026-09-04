import { TaxRuleSetSelectorSchema } from '#/schema/tax-analysis-v2'

import type { TaxRuleSetSelector } from '#/schema/tax-analysis-v2'

export type SelectableTaxRuleSet = TaxRuleSetSelector & {
  id: string
  effectiveFrom: string
  effectiveTo: string | null
  reviewStatus: 'draft' | 'reviewed' | 'active' | 'retired'
}

export function selectApplicableTaxRuleSet(
  selector: TaxRuleSetSelector,
  candidates: SelectableTaxRuleSet[],
) {
  const parsed = TaxRuleSetSelectorSchema.parse(selector)
  return candidates
    .filter((candidate) =>
      candidate.reviewStatus === 'active' &&
      candidate.purpose === parsed.purpose &&
      candidate.taxRegime === parsed.taxRegime &&
      candidate.vatFilingFrequency === parsed.vatFilingFrequency &&
      candidate.effectiveFrom <= parsed.period.startDate &&
      (!candidate.effectiveTo || candidate.effectiveTo >= parsed.period.endDate),
    )
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0] ?? null
}
