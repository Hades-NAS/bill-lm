import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260905090000_backfill_official_tax_rule_source_titles/migration.sql',
  ),
  'utf8',
)

describe('official tax rule source title migration', () => {
  it('replaces only the two legacy technical source titles', () => {
    expect(sql).toContain(
      "SET \"title\" = 'Ley de Régimen Tributario Interno (LRTI)'",
    )
    expect(sql).toContain(
      "SET \"title\" = 'Reglamento para la Aplicación de la Ley de Régimen Tributario Interno (RLRTI)'",
    )
    expect(sql).toContain('AND "title" = \'ec-sri-lrti\'')
    expect(sql).toContain('AND "title" = \'ec-sri-rlrti\'')
  })
})
