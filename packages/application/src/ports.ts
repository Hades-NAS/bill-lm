import type {
  CollectionContextRevision,
  EconomicActivityRevision,
  TaxpayerProfileRevision,
} from '@bill-lm/domain'

import type { ApplicationError } from './errors'
import type { Result } from '@bill-lm/domain'

export type ActorScope = Readonly<{ userId: string }>

export type Clock = Readonly<{ now: () => Date }>

export type IdGenerator = Readonly<{ next: () => string }>

export type EconomicActivity = Readonly<{
  id: string
  latestRevision: EconomicActivityRevision
}>

export type TaxpayerProfile = Readonly<{
  id: string
  latestRevision: TaxpayerProfileRevision
}>

export type CollectionContext = Readonly<{
  id: string
  latestRevision: CollectionContextRevision | null
}>

/**
 * A semantic persistence boundary. Implementations must apply each write as
 * one atomic aggregate operation and constrain every read/write by `scope`.
 */
export type ProfileActivityRepository = Readonly<{
  listActivities: (
    scope: ActorScope,
  ) => Promise<Result<readonly EconomicActivity[], ApplicationError>>
  findActivity: (
    scope: ActorScope,
    activityId: string,
  ) => Promise<Result<EconomicActivity, ApplicationError>>
  createActivity: (
    scope: ActorScope,
    revision: EconomicActivityRevision,
  ) => Promise<Result<EconomicActivityRevision, ApplicationError>>
  appendActivityRevision: (
    scope: ActorScope,
    revision: EconomicActivityRevision,
  ) => Promise<Result<EconomicActivityRevision, ApplicationError>>
  listProfiles: (
    scope: ActorScope,
  ) => Promise<Result<readonly TaxpayerProfile[], ApplicationError>>
  findProfile: (
    scope: ActorScope,
    profileId: string,
  ) => Promise<Result<TaxpayerProfile, ApplicationError>>
  validateActivityRevisions: (
    scope: ActorScope,
    activityRevisionIds: readonly string[],
  ) => Promise<Result<void, ApplicationError>>
  createProfile: (
    scope: ActorScope,
    revision: TaxpayerProfileRevision,
  ) => Promise<Result<TaxpayerProfileRevision, ApplicationError>>
  appendProfileRevision: (
    scope: ActorScope,
    revision: TaxpayerProfileRevision,
  ) => Promise<Result<TaxpayerProfileRevision, ApplicationError>>
}>

/**
 * Persistence owns atomic append and scope checks. It must validate that the
 * selected profile/activity revisions belong to `scope` before appending.
 */
export type CollectionContextRepository = Readonly<{
  listCollectionContexts: (
    scope: ActorScope,
  ) => Promise<Result<readonly CollectionContext[], ApplicationError>>
  findCollectionContext: (
    scope: ActorScope,
    collectionId: string,
  ) => Promise<Result<CollectionContext, ApplicationError>>
  createCollectionContext: (
    scope: ActorScope,
    collectionId: string,
    createdAt: string,
  ) => Promise<Result<CollectionContext, ApplicationError>>
  validateContextReferences: (
    scope: ActorScope,
    taxpayerProfileRevisionId: string,
    activityRevisionIds: readonly string[],
  ) => Promise<Result<void, ApplicationError>>
  appendCollectionContextRevision: (
    scope: ActorScope,
    revision: CollectionContextRevision,
  ) => Promise<Result<CollectionContextRevision, ApplicationError>>
}>
