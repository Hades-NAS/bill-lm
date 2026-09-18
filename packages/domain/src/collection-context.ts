import { revisionMustBePositive } from './errors'
import { err, ok } from './result'

import type { DomainError } from './errors'
import type { Result } from './result'

export type TaxPurpose =
  | 'vat_credit'
  | 'business_income_tax'
  | 'personal_expenses'

export type CollectionContextRevisionInput = {
  readonly id: string
  readonly collectionId: string
  readonly revision: number
  readonly createdAt: string
  readonly purpose: TaxPurpose
  readonly period: Readonly<{ startDate: string; endDate: string }>
  readonly taxpayerProfileRevisionId: string
  readonly activityRevisionIds: readonly string[]
  readonly notes?: string
}

export type CollectionContextRevision = Omit<
  CollectionContextRevisionInput,
  'activityRevisionIds' | 'period'
> & {
  readonly period: Readonly<{ startDate: string; endDate: string }>
  readonly activityRevisionIds: readonly string[]
}

export function createCollectionContextRevision(
  input: CollectionContextRevisionInput,
): Result<CollectionContextRevision, DomainError> {
  if (!Number.isInteger(input.revision) || input.revision <= 0)
    return err(revisionMustBePositive())

  return ok(
    Object.freeze({
      ...input,
      period: Object.freeze({ ...input.period }),
      activityRevisionIds: Object.freeze([...input.activityRevisionIds]),
    }),
  )
}
