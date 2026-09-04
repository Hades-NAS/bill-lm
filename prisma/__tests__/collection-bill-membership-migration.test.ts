import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260904030800_add_collection_bill_memberships/migration.sql',
  ),
  'utf8',
)

describe('collection bill membership migration', () => {
  it('backfills exactly one membership per legacy bill without altering it', () => {
    expect(migrationSql).toContain('INSERT INTO "collection_bill_memberships"')
    expect(migrationSql).toContain('SELECT md5')
    expect(migrationSql).not.toMatch(/^\s*(?:ALTER|DROP|DELETE|UPDATE)\s+/im)
  })

  it('prevents duplicate membership pairs at database level', () => {
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX "collection_bill_membership_unique"',
    )
  })
})
