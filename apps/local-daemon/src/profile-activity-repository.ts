import {
  invalidActivityRevision,
  repositoryFailure,
  resourceNotFound,
} from '@bill-lm/application'
import { err, ok } from '@bill-lm/domain'

import type {
  ActorScope,
  ProfileActivityRepository,
} from '@bill-lm/application'
import type {
  EconomicActivityRevision,
  TaxpayerProfileRevision,
} from '@bill-lm/domain'
import type { Database } from 'bun:sqlite'

type LocalProfileActivityStorage = Readonly<{
  database: Database
  transaction: <Value>(work: () => Value) => Value
}>

type RevisionRow = Readonly<{
  id: string
  aggregate_id: string
  revision_json: string
}>

function activityRevision(row: RevisionRow): EconomicActivityRevision {
  return JSON.parse(row.revision_json) as EconomicActivityRevision
}

function profileRevision(
  database: Database,
  row: RevisionRow,
): TaxpayerProfileRevision {
  const revision = JSON.parse(row.revision_json) as TaxpayerProfileRevision
  const activityRevisionIds = database
    .query(
      `SELECT economic_activity_revision_id
       FROM local_taxpayer_profile_activity_revisions
       WHERE taxpayer_profile_revision_id = ?
       ORDER BY rowid ASC`,
    )
    .all(row.id)
    .map((link) =>
      String((link as Record<string, unknown>).economic_activity_revision_id),
    )
  return { ...revision, activityRevisionIds }
}

function latestRows(
  database: Database,
  table:
    | 'local_economic_activity_revisions'
    | 'local_taxpayer_profile_revisions',
  scope: ActorScope,
): RevisionRow[] {
  return database
    .query(
      `SELECT id, ${table === 'local_economic_activity_revisions' ? 'activity_id' : 'taxpayer_profile_id'} AS aggregate_id, revision_json
       FROM ${table} AS current
       WHERE scope_id = ? AND revision = (
         SELECT MAX(candidate.revision)
         FROM ${table} AS candidate
         WHERE candidate.${table === 'local_economic_activity_revisions' ? 'activity_id' : 'taxpayer_profile_id'} = current.${table === 'local_economic_activity_revisions' ? 'activity_id' : 'taxpayer_profile_id'}
           AND candidate.scope_id = current.scope_id
       )
       ORDER BY created_at DESC`,
    )
    .all(scope.userId) as RevisionRow[]
}

/** SQLite implementation of the profile/activity port for one local library. */
export function createLocalProfileActivityRepository(
  storage: LocalProfileActivityStorage,
): ProfileActivityRepository {
  const { database } = storage

  return {
    async listActivities(scope) {
      try {
        return ok(
          latestRows(database, 'local_economic_activity_revisions', scope).map(
            (row) => ({
              id: row.aggregate_id,
              latestRevision: activityRevision(row),
            }),
          ),
        )
      } catch {
        return err(repositoryFailure())
      }
    },
    async findActivity(scope, activityId) {
      try {
        const row = database
          .query(
            `SELECT id, activity_id AS aggregate_id, revision_json
             FROM local_economic_activity_revisions
             WHERE scope_id = ? AND activity_id = ?
             ORDER BY revision DESC LIMIT 1`,
          )
          .get(scope.userId, activityId) as RevisionRow | null
        return row
          ? ok({ id: row.aggregate_id, latestRevision: activityRevision(row) })
          : err(resourceNotFound())
      } catch {
        return err(repositoryFailure())
      }
    },
    async createActivity(scope, revision) {
      try {
        storage.transaction(() => {
          database
            .query(
              `INSERT INTO local_economic_activities (id, scope_id, created_at)
               VALUES (?, ?, ?)`,
            )
            .run(revision.activityId, scope.userId, revision.createdAt)
          database
            .query(
              `INSERT INTO local_economic_activity_revisions
               (id, activity_id, scope_id, revision, revision_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .run(
              revision.id,
              revision.activityId,
              scope.userId,
              revision.revision,
              JSON.stringify(revision),
              revision.createdAt,
            )
        })
        return ok(revision)
      } catch {
        return err(repositoryFailure())
      }
    },
    async appendActivityRevision(scope, revision) {
      try {
        database
          .query(
            `INSERT INTO local_economic_activity_revisions
             (id, activity_id, scope_id, revision, revision_json, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            revision.id,
            revision.activityId,
            scope.userId,
            revision.revision,
            JSON.stringify(revision),
            revision.createdAt,
          )
        return ok(revision)
      } catch {
        return err(repositoryFailure())
      }
    },
    async listProfiles(scope) {
      try {
        return ok(
          latestRows(database, 'local_taxpayer_profile_revisions', scope).map(
            (row) => ({
              id: row.aggregate_id,
              latestRevision: profileRevision(database, row),
            }),
          ),
        )
      } catch {
        return err(repositoryFailure())
      }
    },
    async findProfile(scope, profileId) {
      try {
        const row = database
          .query(
            `SELECT id, taxpayer_profile_id AS aggregate_id, revision_json
             FROM local_taxpayer_profile_revisions
             WHERE scope_id = ? AND taxpayer_profile_id = ?
             ORDER BY revision DESC LIMIT 1`,
          )
          .get(scope.userId, profileId) as RevisionRow | null
        return row
          ? ok({
              id: row.aggregate_id,
              latestRevision: profileRevision(database, row),
            })
          : err(resourceNotFound())
      } catch {
        return err(repositoryFailure())
      }
    },
    async validateActivityRevisions(scope, activityRevisionIds) {
      try {
        if (activityRevisionIds.length === 0) return ok(undefined)
        const placeholders = activityRevisionIds.map(() => '?').join(', ')
        const rows = database
          .query(
            `SELECT id FROM local_economic_activity_revisions
             WHERE scope_id = ? AND id IN (${placeholders})`,
          )
          .all(scope.userId, ...activityRevisionIds)
        return rows.length === activityRevisionIds.length
          ? ok(undefined)
          : err(invalidActivityRevision())
      } catch {
        return err(repositoryFailure())
      }
    },
    async createProfile(scope, revision) {
      try {
        storage.transaction(() => {
          database
            .query(
              `INSERT INTO local_taxpayer_profiles (id, scope_id, created_at)
               VALUES (?, ?, ?)`,
            )
            .run(revision.taxpayerProfileId, scope.userId, revision.createdAt)
          insertProfileRevision(database, scope, revision)
        })
        return ok(revision)
      } catch {
        return err(repositoryFailure())
      }
    },
    async appendProfileRevision(scope, revision) {
      try {
        storage.transaction(() =>
          insertProfileRevision(database, scope, revision),
        )
        return ok(revision)
      } catch {
        return err(repositoryFailure())
      }
    },
  }
}

function insertProfileRevision(
  database: Database,
  scope: ActorScope,
  revision: TaxpayerProfileRevision,
) {
  database
    .query(
      `INSERT INTO local_taxpayer_profile_revisions
       (id, taxpayer_profile_id, scope_id, revision, revision_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      revision.id,
      revision.taxpayerProfileId,
      scope.userId,
      revision.revision,
      JSON.stringify(revision),
      revision.createdAt,
    )
  const link = database.query(
    `INSERT INTO local_taxpayer_profile_activity_revisions
     (taxpayer_profile_revision_id, economic_activity_revision_id, scope_id)
     VALUES (?, ?, ?)`,
  )
  for (const activityRevisionId of revision.activityRevisionIds)
    link.run(revision.id, activityRevisionId, scope.userId)
}
