import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260903213000_add_taxpayer_profiles_and_activities/migration.sql',
  ),
  'utf8',
)

describe('taxpayer profile migration', () => {
  it('keeps profile and activity revisions owned by the same user', () => {
    expect(migrationSql).toContain(
      'FOREIGN KEY ("taxpayerProfileRevisionId", "userId")',
    )
    expect(migrationSql).toContain(
      'REFERENCES "taxpayer_profile_revisions"("id", "userId")',
    )
    expect(migrationSql).toContain(
      'FOREIGN KEY ("economicActivityRevisionId", "userId")',
    )
    expect(migrationSql).toContain(
      'REFERENCES "economic_activity_revisions"("id", "userId")',
    )
  })

  it('is additive and does not modify legacy collection or invoice tables', () => {
    expect(migrationSql).not.toMatch(
      /^\s*(?:ALTER|DROP|DELETE|UPDATE)\s+/im,
    )
    expect(migrationSql).toContain('CREATE TABLE "taxpayer_profiles"')
    expect(migrationSql).toContain('CREATE TABLE "economic_activities"')
  })
})
