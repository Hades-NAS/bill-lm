import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const migrationSql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260904150000_relax_legacy_collection_identity_columns/migration.sql',
  ),
  'utf8',
)

describe('legacy collection identity migration', () => {
  it('keeps historical values and permits new collections without legacy identity fields', () => {
    expect(migrationSql).toContain('ALTER TABLE "collections"')
    expect(migrationSql).toContain(
      'ALTER COLUMN "personalIdNumber" DROP NOT NULL',
    )
    expect(migrationSql).toContain(
      'ALTER COLUMN "professionalIdNumber" DROP NOT NULL',
    )
    expect(migrationSql).not.toMatch(/\b(?:DROP COLUMN|DELETE|UPDATE)\b/i)
  })
})
