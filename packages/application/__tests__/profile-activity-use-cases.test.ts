import { describe, expect, it } from 'vitest'

import {
  createCollectionContextUseCases,
  createProfileActivityUseCases,
  invalidCollectionContextReference,
  invalidActivityRevision,
  repositoryFailure,
  resourceNotFound,
} from '../src'

import type {
  ActorScope,
  CollectionContext,
  CollectionContextRepository,
  CollectionContextRevisionDraft,
  EconomicActivity,
  EconomicActivityDraft,
  ProfileActivityRepository,
  TaxpayerProfile,
  TaxpayerProfileDraft,
} from '../src'
import type {
  CollectionContextRevision,
  EconomicActivityRevision,
  TaxpayerProfileRevision,
} from '@bill-lm/domain'
import { err, ok } from '@bill-lm/domain'

const owner = { userId: 'owner' } as const satisfies ActorScope
const other = { userId: 'other' } as const satisfies ActorScope

const activityDraft: EconomicActivityDraft = {
  displayName: 'Venta de software',
  registeredActivityName: 'Desarrollo de software',
  activityDescription: 'Servicios de desarrollo de software.',
  revenueVatTreatment: 'taxed_nonzero',
}

const profileDraft = (
  activityRevisionIds: readonly string[],
): TaxpayerProfileDraft => ({
  displayName: 'Consultoría',
  hasEmploymentIncome: false,
  hasRuc: true,
  taxRegime: 'general',
  vatFilingFrequency: 'monthly',
  activityRevisionIds,
})

class InMemoryRepository implements ProfileActivityRepository {
  readonly activities = new Map<string, EconomicActivity>()
  readonly profiles = new Map<string, TaxpayerProfile>()
  readonly validActivityRevisions = new Map<string, Set<string>>()
  readonly calls = { createActivity: 0, createProfile: 0 }
  failWrites = false

  async listActivities(scope: ActorScope) {
    return ok(
      [...this.activities.values()].filter((activity) =>
        activity.latestRevision.activityId.startsWith(`${scope.userId}:`),
      ),
    )
  }

  async findActivity(scope: ActorScope, activityId: string) {
    const activity = this.activities.get(activityId)
    return activity?.latestRevision.activityId.startsWith(`${scope.userId}:`)
      ? ok(activity)
      : err(resourceNotFound())
  }

  async createActivity(scope: ActorScope, revision: EconomicActivityRevision) {
    this.calls.createActivity += 1
    if (this.failWrites) return err(repositoryFailure())
    const owned = {
      ...revision,
      activityId: `${scope.userId}:${revision.activityId}`,
    }
    this.activities.set(revision.activityId, {
      id: revision.activityId,
      latestRevision: owned,
    })
    this.addValidRevision(scope, owned.id)
    return ok(owned)
  }

  async appendActivityRevision(
    scope: ActorScope,
    revision: EconomicActivityRevision,
  ) {
    if (this.failWrites) return err(repositoryFailure())
    const existing = this.activities.get(revision.activityId)
    if (
      !existing ||
      !existing.latestRevision.activityId.startsWith(`${scope.userId}:`)
    )
      return err(resourceNotFound())
    const owned = {
      ...revision,
      activityId: `${scope.userId}:${revision.activityId}`,
    }
    this.activities.set(revision.activityId, {
      id: revision.activityId,
      latestRevision: owned,
    })
    this.addValidRevision(scope, owned.id)
    return ok(owned)
  }

  async listProfiles(scope: ActorScope) {
    return ok(
      [...this.profiles.values()].filter((profile) =>
        profile.latestRevision.taxpayerProfileId.startsWith(`${scope.userId}:`),
      ),
    )
  }

  async findProfile(scope: ActorScope, profileId: string) {
    const profile = this.profiles.get(profileId)
    return profile?.latestRevision.taxpayerProfileId.startsWith(
      `${scope.userId}:`,
    )
      ? ok(profile)
      : err(resourceNotFound())
  }

  async validateActivityRevisions(
    scope: ActorScope,
    activityRevisionIds: readonly string[],
  ) {
    const ownedIds = this.validActivityRevisions.get(scope.userId) ?? new Set()
    return activityRevisionIds.every((id) => ownedIds.has(id))
      ? ok(undefined)
      : err(invalidActivityRevision())
  }

  async createProfile(scope: ActorScope, revision: TaxpayerProfileRevision) {
    this.calls.createProfile += 1
    if (this.failWrites) return err(repositoryFailure())
    const owned = {
      ...revision,
      taxpayerProfileId: `${scope.userId}:${revision.taxpayerProfileId}`,
    }
    this.profiles.set(revision.taxpayerProfileId, {
      id: revision.taxpayerProfileId,
      latestRevision: owned,
    })
    return ok(owned)
  }

  async appendProfileRevision(
    scope: ActorScope,
    revision: TaxpayerProfileRevision,
  ) {
    if (this.failWrites) return err(repositoryFailure())
    const existing = this.profiles.get(revision.taxpayerProfileId)
    if (
      !existing ||
      !existing.latestRevision.taxpayerProfileId.startsWith(`${scope.userId}:`)
    )
      return err(resourceNotFound())
    const owned = {
      ...revision,
      taxpayerProfileId: `${scope.userId}:${revision.taxpayerProfileId}`,
    }
    this.profiles.set(revision.taxpayerProfileId, {
      id: revision.taxpayerProfileId,
      latestRevision: owned,
    })
    return ok(owned)
  }

  addValidRevision(scope: ActorScope, revisionId: string) {
    const values = this.validActivityRevisions.get(scope.userId) ?? new Set()
    values.add(revisionId)
    this.validActivityRevisions.set(scope.userId, values)
  }
}

function makeSubject(repository = new InMemoryRepository()) {
  let identifier = 0
  return {
    repository,
    useCases: createProfileActivityUseCases({
      repository,
      clock: { now: () => new Date('2026-09-13T12:00:00.000Z') },
      ids: { next: () => `id-${++identifier}` },
    }),
  }
}

const collectionId = '1ee4824c-8fc4-42cf-8d02-e963a78d16d8'
const profileRevisionId = '2ee4824c-8fc4-42cf-8d02-e963a78d16d8'
const activityRevisionId = '3ee4824c-8fc4-42cf-8d02-e963a78d16d8'

const contextDraft = (): CollectionContextRevisionDraft => ({
  purpose: 'vat_credit',
  period: { startDate: '2026-01-01', endDate: '2026-01-31' },
  taxpayerProfileRevisionId: profileRevisionId,
  activityRevisionIds: [activityRevisionId],
  notes: 'Enero',
})

class InMemoryCollectionContextRepository implements CollectionContextRepository {
  readonly collections = new Map<string, CollectionContext>()
  readonly validProfiles = new Map<string, Set<string>>()
  readonly validActivities = new Map<string, Set<string>>()
  appendCalls = 0

  constructor() {
    this.collections.set(collectionId, {
      id: collectionId,
      latestRevision: {
        id: '4ee4824c-8fc4-42cf-8d02-e963a78d16d8',
        collectionId,
        revision: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        purpose: 'vat_credit',
        period: { startDate: '2025-12-01', endDate: '2025-12-31' },
        taxpayerProfileRevisionId: profileRevisionId,
        activityRevisionIds: [activityRevisionId],
      },
    })
    this.validProfiles.set(owner.userId, new Set([profileRevisionId]))
    this.validActivities.set(owner.userId, new Set([activityRevisionId]))
  }

  async listCollectionContexts(scope: ActorScope) {
    return scope.userId === owner.userId
      ? ok([...this.collections.values()])
      : ok([])
  }

  async createCollectionContext(
    scope: ActorScope,
    id: string,
    _createdAt: string,
  ) {
    if (scope.userId !== owner.userId) return err(resourceNotFound())
    const collection: CollectionContext = { id, latestRevision: null }
    this.collections.set(id, collection)
    return ok(collection)
  }

  async findCollectionContext(scope: ActorScope, id: string) {
    return scope.userId === owner.userId && this.collections.has(id)
      ? ok(this.collections.get(id)!)
      : err(resourceNotFound())
  }

  async validateContextReferences(
    scope: ActorScope,
    taxpayerProfileRevisionId: string,
    activityRevisionIds: readonly string[],
  ) {
    const profiles = this.validProfiles.get(scope.userId) ?? new Set()
    const activities = this.validActivities.get(scope.userId) ?? new Set()
    return profiles.has(taxpayerProfileRevisionId) &&
      activityRevisionIds.every((id) => activities.has(id))
      ? ok(undefined)
      : err(invalidCollectionContextReference())
  }

  async appendCollectionContextRevision(
    scope: ActorScope,
    revision: CollectionContextRevision,
  ) {
    this.appendCalls += 1
    if (scope.userId !== owner.userId) return err(resourceNotFound())
    this.collections.set(revision.collectionId, {
      id: revision.collectionId,
      latestRevision: revision,
    })
    return ok(revision)
  }
}

function makeCollectionSubject(
  repository = new InMemoryCollectionContextRepository(),
) {
  let identifier = 10
  return {
    repository,
    useCases: createCollectionContextUseCases({
      repository,
      clock: { now: () => new Date('2026-09-17T12:00:00.000Z') },
      ids: { next: () => `5ee4824c-8fc4-42cf-8d02-e963a78d16d${++identifier}` },
    }),
  }
}

describe('profile and activity application use cases', () => {
  it('creates an activity with injected IDs, timestamp, and revision one', async () => {
    const { useCases } = makeSubject()

    const result = await useCases.createActivity(owner, activityDraft)

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: 'id-1',
        activityId: 'owner:id-2',
        revision: 1,
        createdAt: '2026-09-13T12:00:00.000Z',
      },
    })
  })

  it('revises an owned activity without changing its previous revision', async () => {
    const { useCases, repository } = makeSubject()
    const created = await useCases.createActivity(owner, activityDraft)
    if (!created.ok) throw new Error('expected activity creation')

    const revised = await useCases.reviseActivity(owner, 'id-2', {
      ...activityDraft,
      displayName: 'Venta de software revisada',
    })

    expect(revised).toMatchObject({ ok: true, value: { revision: 2 } })
    expect(created.value.revision).toBe(1)
    expect(repository.activities.get('id-2')?.latestRevision.revision).toBe(2)
  })

  it('returns domain invariant failures before persisting an invalid activity', async () => {
    const { useCases, repository } = makeSubject()

    const result = await useCases.createActivity(owner, {
      ...activityDraft,
      revenueVatTreatment: 'other',
    })

    expect(result).toEqual({
      ok: false,
      error: { code: 'economic_activity.revenue_vat_treatment_other_required' },
    })
    expect(repository.calls.createActivity).toBe(0)
  })

  it('does not expose missing or foreign activities through revision', async () => {
    const { useCases } = makeSubject()
    const missing = await useCases.reviseActivity(
      owner,
      'missing',
      activityDraft,
    )
    expect(missing).toEqual({
      ok: false,
      error: { code: 'resource.not_found' },
    })

    const created = await useCases.createActivity(other, activityDraft)
    if (!created.ok) throw new Error('expected activity creation')
    const foreign = await useCases.reviseActivity(owner, 'id-2', activityDraft)
    expect(foreign).toEqual({
      ok: false,
      error: { code: 'resource.not_found' },
    })
  })

  it('rejects missing, foreign, and duplicate activity revision references', async () => {
    const { useCases, repository } = makeSubject()
    repository.addValidRevision(owner, 'owned-revision')
    repository.addValidRevision(other, 'foreign-revision')

    await expect(
      useCases.createProfile(owner, profileDraft(['missing'])),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'activity_revision.invalid' },
    })
    await expect(
      useCases.createProfile(owner, profileDraft(['foreign-revision'])),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'activity_revision.invalid' },
    })
    await expect(
      useCases.createProfile(
        owner,
        profileDraft(['owned-revision', 'owned-revision']),
      ),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'activity_revision.duplicate' },
    })
    expect(repository.calls.createProfile).toBe(0)
  })

  it('creates and revises an immutable profile at the next revision number', async () => {
    const { useCases, repository } = makeSubject()
    repository.addValidRevision(owner, 'activity-revision')
    const created = await useCases.createProfile(
      owner,
      profileDraft(['activity-revision']),
    )
    if (!created.ok) throw new Error('expected profile creation')

    const revised = await useCases.reviseProfile(
      owner,
      'id-2',
      profileDraft(['activity-revision']),
    )

    expect(created.value.revision).toBe(1)
    expect(revised).toMatchObject({ ok: true, value: { revision: 2 } })
  })

  it('returns a sanitized repository failure', async () => {
    const repository = new InMemoryRepository()
    repository.failWrites = true
    const { useCases } = makeSubject(repository)

    await expect(
      useCases.createActivity(owner, activityDraft),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'repository.failure' },
    })
  })

  it('lists only active resources returned for the caller scope', async () => {
    const { useCases } = makeSubject()
    await useCases.createActivity(owner, activityDraft)
    await useCases.createActivity(other, activityDraft)

    const result = await useCases.listActivities(owner)

    expect(result).toMatchObject({ ok: true })
    if (result.ok) expect(result.value).toHaveLength(1)
  })
})

describe('collection context application use cases', () => {
  it('creates an empty collection and appends its first context revision', async () => {
    const { useCases } = makeCollectionSubject()

    const created = await useCases.createCollectionContext(owner)
    expect(created).toMatchObject({ ok: true, value: { latestRevision: null } })
    if (!created.ok) throw new Error('expected collection creation')
    const revision = await useCases.createCollectionContextRevision(
      owner,
      created.value.id,
      contextDraft(),
    )
    expect(revision).toMatchObject({ ok: true, value: { revision: 1 } })
  })

  it('appends the next immutable revision with injected ID and timestamp', async () => {
    const { repository, useCases } = makeCollectionSubject()
    const draft = contextDraft()

    const result = await useCases.createCollectionContextRevision(
      owner,
      collectionId,
      draft,
    )
    draft.activityRevisionIds.push('foreign-mutation')
    draft.period.startDate = '2020-01-01'

    expect(result).toMatchObject({
      ok: true,
      value: {
        collectionId,
        revision: 2,
        createdAt: '2026-09-17T12:00:00.000Z',
        activityRevisionIds: [activityRevisionId],
        period: { startDate: '2026-01-01', endDate: '2026-01-31' },
      },
    })
    expect(repository.appendCalls).toBe(1)
  })

  it('does not append a missing or foreign collection context', async () => {
    const { repository, useCases } = makeCollectionSubject()

    await expect(
      useCases.createCollectionContextRevision(
        owner,
        'missing',
        contextDraft(),
      ),
    ).resolves.toEqual({ ok: false, error: { code: 'resource.not_found' } })
    await expect(
      useCases.createCollectionContextRevision(
        other,
        collectionId,
        contextDraft(),
      ),
    ).resolves.toEqual({ ok: false, error: { code: 'resource.not_found' } })
    expect(repository.appendCalls).toBe(0)
  })

  it('validates owned profile and activity revision references before append', async () => {
    const { repository, useCases } = makeCollectionSubject()
    const draft = contextDraft()
    draft.taxpayerProfileRevisionId = '6ee4824c-8fc4-42cf-8d02-e963a78d16d8'

    await expect(
      useCases.createCollectionContextRevision(owner, collectionId, draft),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'collection_context_reference.invalid' },
    })
    expect(repository.appendCalls).toBe(0)
  })

  it('rejects an invalid contract draft before reading or appending', async () => {
    const { repository, useCases } = makeCollectionSubject()
    const draft = contextDraft()
    draft.activityRevisionIds = [activityRevisionId, activityRevisionId]

    await expect(
      useCases.createCollectionContextRevision(owner, collectionId, draft),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'collection_context_reference.invalid' },
    })
    expect(repository.appendCalls).toBe(0)
  })
})
