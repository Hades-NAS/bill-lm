import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('remove legacy bill analysis columns migration', () => {
  it('removes the percentage and reason projections from BillHeader', async () => {
    const migration = await readFile(
      resolve(
        import.meta.dirname,
        '../migrations/20260905100000_remove_legacy_bill_analysis_columns/migration.sql',
      ),
      'utf8',
    )

    expect(migration).toContain('DROP COLUMN "percentage"')
    expect(migration).toContain('DROP COLUMN "reason"')
  })
})
