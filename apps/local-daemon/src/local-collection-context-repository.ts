import {
  invalidCollectionContextReference,
  repositoryFailure,
  resourceNotFound,
} from '@bill-lm/application'
import { err, ok } from '@bill-lm/domain'

import type {
  ActorScope,
  CollectionContextRepository,
} from '@bill-lm/application'
import type { CollectionContextRevision } from '@bill-lm/domain'
import type { Database } from 'bun:sqlite'

type LocalCollectionContextStorage = Readonly<{
  database: Database
  transaction: <Value>(work: () => Value) => Value
}>

type RevisionRow = Readonly<{
  id: string
  collection_id: string
  revision_json: string
}>

function readRevision(row: RevisionRow): CollectionContextRevision {
  return JSON.parse(row.revision_json) as CollectionContextRevision
}

/** SQLite adapter for collection context scoped to one local library identity. */
export function createLocalCollectionContextRepository(
  storage: LocalCollectionContextStorage,
): CollectionContextRepository {
  const { database } = storage

  function latestRevision(scope: ActorScope, collectionId: string) {
    return database
      .query(
        `SELECT id, collection_id, revision_json
         FROM local_collection_context_revisions
         WHERE scope_id = ? AND collection_id = ?
         ORDER BY revision DESC LIMIT 1`,
      )
      .get(scope.userId, collectionId) as RevisionRow | null
  }

  return {
    async listCollectionContexts(scope) {
      try {
        const rows = database
          .query(
            `SELECT id FROM local_collections
             WHERE scope_id = ? ORDER BY created_at ASC`,
          )
          .all(scope.userId) as Array<{ id: string }>
        return ok(
          rows.map((row) => {
            const revision = latestRevision(scope, row.id)
            return { id: row.id, latestRevision: revision ? readRevision(revision) : null }
          }),
        )
      } catch {
        return err(repositoryFailure())
      }
    },
    async findCollectionContext(scope, collectionId) {
      try {
        const collection = database
          .query('SELECT id FROM local_collections WHERE scope_id = ? AND id = ?')
          .get(scope.userId, collectionId) as { id: string } | null
        if (!collection) return err(resourceNotFound())
        const revision = latestRevision(scope, collection.id)
        return ok({
          id: collection.id,
          latestRevision: revision ? readRevision(revision) : null,
        })
      } catch {
        return err(repositoryFailure())
      }
    },
    async createCollectionContext(scope, collectionId, createdAt) {
      try {
        database
          .query(
            `INSERT INTO local_collections (id, scope_id, created_at)
             VALUES (?, ?, ?)`,
          )
          .run(collectionId, scope.userId, createdAt)
        return ok({ id: collectionId, latestRevision: null })
      } catch {
        return err(repositoryFailure())
      }
    },
    async validateContextReferences(
      scope,
      taxpayerProfileRevisionId,
      activityRevisionIds,
    ) {
      try {
        const profile = database
          .query(
            `SELECT 1 FROM local_taxpayer_profile_revisions
             WHERE scope_id = ? AND id = ?`,
          )
          .get(scope.userId, taxpayerProfileRevisionId)
        if (!profile) return err(invalidCollectionContextReference())
        if (activityRevisionIds.length === 0) return ok(undefined)
        const placeholders = activityRevisionIds.map(() => '?').join(', ')
        const activities = database
          .query(
            `SELECT id FROM local_economic_activity_revisions
             WHERE scope_id = ? AND id IN (${placeholders})`,
          )
          .all(scope.userId, ...activityRevisionIds)
        return activities.length === activityRevisionIds.length
          ? ok(undefined)
          : err(invalidCollectionContextReference())
      } catch {
        return err(repositoryFailure())
      }
    },
    async appendCollectionContextRevision(scope, revision) {
      try {
        storage.transaction(() => {
          database
            .query(
              `INSERT INTO local_collection_context_revisions
               (id, collection_id, scope_id, revision, revision_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .run(
              revision.id,
              revision.collectionId,
              scope.userId,
              revision.revision,
              JSON.stringify(revision),
              revision.createdAt,
            )
          const link = database.query(
            `INSERT INTO local_collection_context_activity_revisions
             (collection_context_revision_id, economic_activity_revision_id, scope_id)
             VALUES (?, ?, ?)`,
          )
          for (const activityRevisionId of revision.activityRevisionIds)
            link.run(revision.id, activityRevisionId, scope.userId)
        })
        return ok(revision)
      } catch {
        return err(repositoryFailure())
      }
    },
  }
}
