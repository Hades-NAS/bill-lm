import { CollectionContextRevisionInputSchema } from '@bill-lm/contracts'
import {
  createCollectionContextRevision as createDomainCollectionContextRevision,
  createEconomicActivityRevision,
  createTaxpayerProfileRevision,
  err,
  ok,
} from '@bill-lm/domain'

import {
  duplicateActivityRevision,
  invalidCollectionContextReference,
} from './errors'

import type { ApplicationError } from './errors'
import type {
  CollectionContextRevision,
  EconomicActivityRevision,
  EconomicActivityRevisionInput,
  Result,
  TaxpayerProfileRevision,
  TaxpayerProfileRevisionInput,
} from '@bill-lm/domain'
import type {
  ActorScope,
  Clock,
  CollectionContextRepository,
  EconomicActivity,
  IdGenerator,
  ProfileActivityRepository,
  TaxpayerProfile,
} from './ports'

export type EconomicActivityDraft = Omit<
  EconomicActivityRevisionInput,
  'id' | 'activityId' | 'revision' | 'createdAt'
>

export type TaxpayerProfileDraft = Omit<
  TaxpayerProfileRevisionInput,
  'id' | 'taxpayerProfileId' | 'revision' | 'createdAt'
>

export type CollectionContextRevisionDraft =
  import('@bill-lm/contracts').CollectionContextRevisionInput

export type UseCaseError = ApplicationError | ReturnType<typeof domainError>

function domainError(code: string): { readonly code: string } {
  return { code }
}

function mapDomain<Value>(
  result: Result<Value, { readonly code: string }>,
): Result<Value, UseCaseError> {
  return result.ok ? ok(result.value) : err(domainError(result.error.code))
}

function hasDuplicateIds(ids: readonly string[]): boolean {
  return new Set(ids).size !== ids.length
}

export function createProfileActivityUseCases(
  dependencies: Readonly<{
    repository: ProfileActivityRepository
    clock: Clock
    ids: IdGenerator
  }>,
) {
  const timestamp = () => dependencies.clock.now().toISOString()

  async function listActivities(
    scope: ActorScope,
  ): Promise<Result<readonly EconomicActivity[], ApplicationError>> {
    return dependencies.repository.listActivities(scope)
  }

  async function createActivity(
    scope: ActorScope,
    draft: EconomicActivityDraft,
  ): Promise<Result<EconomicActivityRevision, UseCaseError>> {
    const candidate = mapDomain(
      createEconomicActivityRevision({
        ...draft,
        id: dependencies.ids.next(),
        activityId: dependencies.ids.next(),
        revision: 1,
        createdAt: timestamp(),
      }),
    )
    if (!candidate.ok) return candidate
    return dependencies.repository.createActivity(scope, candidate.value)
  }

  async function reviseActivity(
    scope: ActorScope,
    activityId: string,
    draft: EconomicActivityDraft,
  ): Promise<Result<EconomicActivityRevision, UseCaseError>> {
    const activity = await dependencies.repository.findActivity(
      scope,
      activityId,
    )
    if (!activity.ok) return activity
    const candidate = mapDomain(
      createEconomicActivityRevision({
        ...draft,
        id: dependencies.ids.next(),
        activityId,
        revision: activity.value.latestRevision.revision + 1,
        createdAt: timestamp(),
      }),
    )
    if (!candidate.ok) return candidate
    return dependencies.repository.appendActivityRevision(
      scope,
      candidate.value,
    )
  }

  async function listProfiles(
    scope: ActorScope,
  ): Promise<Result<readonly TaxpayerProfile[], ApplicationError>> {
    return dependencies.repository.listProfiles(scope)
  }

  async function validateActivityRevisions(
    scope: ActorScope,
    activityRevisionIds: readonly string[],
  ): Promise<Result<void, ApplicationError>> {
    if (hasDuplicateIds(activityRevisionIds))
      return err(duplicateActivityRevision())
    return dependencies.repository.validateActivityRevisions(
      scope,
      activityRevisionIds,
    )
  }

  async function createProfile(
    scope: ActorScope,
    draft: TaxpayerProfileDraft,
  ): Promise<Result<TaxpayerProfileRevision, UseCaseError>> {
    const activityValidation = await validateActivityRevisions(
      scope,
      draft.activityRevisionIds,
    )
    if (!activityValidation.ok) return activityValidation
    const candidate = mapDomain(
      createTaxpayerProfileRevision({
        ...draft,
        id: dependencies.ids.next(),
        taxpayerProfileId: dependencies.ids.next(),
        revision: 1,
        createdAt: timestamp(),
      }),
    )
    if (!candidate.ok) return candidate
    return dependencies.repository.createProfile(scope, candidate.value)
  }

  async function reviseProfile(
    scope: ActorScope,
    profileId: string,
    draft: TaxpayerProfileDraft,
  ): Promise<Result<TaxpayerProfileRevision, UseCaseError>> {
    const profile = await dependencies.repository.findProfile(scope, profileId)
    if (!profile.ok) return profile
    const activityValidation = await validateActivityRevisions(
      scope,
      draft.activityRevisionIds,
    )
    if (!activityValidation.ok) return activityValidation
    const candidate = mapDomain(
      createTaxpayerProfileRevision({
        ...draft,
        id: dependencies.ids.next(),
        taxpayerProfileId: profileId,
        revision: profile.value.latestRevision.revision + 1,
        createdAt: timestamp(),
      }),
    )
    if (!candidate.ok) return candidate
    return dependencies.repository.appendProfileRevision(scope, candidate.value)
  }

  return Object.freeze({
    listActivities,
    createActivity,
    reviseActivity,
    listProfiles,
    createProfile,
    reviseProfile,
  })
}

export function createCollectionContextUseCases(
  dependencies: Readonly<{
    repository: CollectionContextRepository
    clock: Clock
    ids: IdGenerator
  }>,
) {
  const timestamp = () => dependencies.clock.now().toISOString()

  async function listCollectionContexts(
    scope: ActorScope,
  ): Promise<
    Result<readonly import('./ports').CollectionContext[], ApplicationError>
  > {
    return dependencies.repository.listCollectionContexts(scope)
  }

  async function createCollectionContext(
    scope: ActorScope,
  ): Promise<Result<import('./ports').CollectionContext, ApplicationError>> {
    const createdAt = timestamp()
    return dependencies.repository.createCollectionContext(
      scope,
      dependencies.ids.next(),
      createdAt,
    )
  }

  async function createCollectionContextRevision(
    scope: ActorScope,
    collectionId: string,
    draft: CollectionContextRevisionDraft,
  ): Promise<Result<CollectionContextRevision, UseCaseError>> {
    const parsed = CollectionContextRevisionInputSchema.safeParse(draft)
    if (!parsed.success) return err(invalidCollectionContextReference())

    const collection = await dependencies.repository.findCollectionContext(
      scope,
      collectionId,
    )
    if (!collection.ok) return collection

    const references = await dependencies.repository.validateContextReferences(
      scope,
      parsed.data.taxpayerProfileRevisionId,
      parsed.data.activityRevisionIds,
    )
    if (!references.ok) return references

    const candidate = mapDomain(
      createDomainCollectionContextRevision({
        ...parsed.data,
        id: dependencies.ids.next(),
        collectionId,
        revision: (collection.value.latestRevision?.revision ?? 0) + 1,
        createdAt: timestamp(),
      }),
    )
    if (!candidate.ok) return candidate

    return dependencies.repository.appendCollectionContextRevision(
      scope,
      candidate.value,
    )
  }

  return Object.freeze({
    listCollectionContexts,
    createCollectionContext,
    createCollectionContextRevision,
  })
}
