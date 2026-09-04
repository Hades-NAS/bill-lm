import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260904100000_add_analysis_runs_and_results/migration.sql',
  ),
  'utf8',
)

describe('analysis run migration', () => {
  it('persists immutable snapshots and prevents duplicate requests', () => {
    expect(sql).toContain('"inputSnapshot" JSONB NOT NULL')
    expect(sql).toContain('"snapshot" JSONB NOT NULL')
    expect(sql).toContain('CREATE UNIQUE INDEX "analysis_run_idempotency_key"')
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "analysis_result_run_bill_unique"',
    )
  })
})
