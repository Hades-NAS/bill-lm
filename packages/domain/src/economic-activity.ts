import {
  revenueVatTreatmentOtherRequired,
  revisionMustBePositive,
} from './errors'
import { err, ok } from './result'

import type { DomainError } from './errors'
import type { Result } from './result'

export type RevenueVatTreatment =
  | 'taxed_nonzero'
  | 'zero_with_credit'
  | 'zero_without_credit'
  | 'mixed'
  | 'export'
  | 'unknown'
  | 'other'

export type EconomicActivityRevisionInput = {
  readonly id: string
  readonly activityId: string
  readonly revision: number
  readonly createdAt: string
  readonly displayName: string
  readonly registeredActivityCode?: string
  readonly registeredActivityName: string
  readonly activityDescription: string
  readonly necessaryPurchases?: string
  readonly revenueVatTreatment: RevenueVatTreatment
  readonly revenueVatTreatmentOther?: string
  readonly mixedUseDescription?: string
  readonly additionalFacts?: string
}

export type EconomicActivityRevision = Readonly<EconomicActivityRevisionInput>

export function createEconomicActivityRevision(
  input: EconomicActivityRevisionInput,
): Result<EconomicActivityRevision, DomainError> {
  if (!Number.isInteger(input.revision) || input.revision <= 0)
    return err(revisionMustBePositive())
  if (input.revenueVatTreatment === 'other' && !input.revenueVatTreatmentOther)
    return err(revenueVatTreatmentOtherRequired())
  return ok(Object.freeze({ ...input }))
}
