import {
  noRucCannotHaveActivities,
  noRucRequiresNoVatFiling,
  revisionMustBePositive,
} from './errors'
import { err, ok } from './result'

import type { DomainError } from './errors'
import type { Result } from './result'

export type TaxRegime =
  | 'general'
  | 'rimpe_entrepreneur'
  | 'rimpe_popular_business'
  | 'unknown'
export type VatFilingFrequency = 'none' | 'monthly' | 'semiannual' | 'unknown'

export type TaxpayerProfileRevisionInput = {
  readonly id: string
  readonly taxpayerProfileId: string
  readonly revision: number
  readonly createdAt: string
  readonly displayName: string
  readonly personalIdNumber?: string
  readonly professionalIdNumber?: string
  readonly hasEmploymentIncome: boolean
  readonly hasRuc: boolean
  readonly taxRegime: TaxRegime
  readonly vatFilingFrequency: VatFilingFrequency
  readonly additionalFacts?: string
  readonly activityRevisionIds: readonly string[]
}

export type TaxpayerProfileRevision = Omit<
  TaxpayerProfileRevisionInput,
  'activityRevisionIds'
> & { readonly activityRevisionIds: readonly string[] }

export function createTaxpayerProfileRevision(
  input: TaxpayerProfileRevisionInput,
): Result<TaxpayerProfileRevision, DomainError> {
  if (!Number.isInteger(input.revision) || input.revision <= 0)
    return err(revisionMustBePositive())
  if (!input.hasRuc && input.vatFilingFrequency !== 'none')
    return err(noRucRequiresNoVatFiling())
  if (!input.hasRuc && input.activityRevisionIds.length > 0)
    return err(noRucCannotHaveActivities())
  return ok(
    Object.freeze({
      ...input,
      activityRevisionIds: Object.freeze([...input.activityRevisionIds]),
    }),
  )
}
