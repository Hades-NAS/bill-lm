import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const startScriptPath = fileURLToPath(
  new URL('../start.sh', import.meta.url),
)

describe('start.sh', () => {
  it('aplica solo migraciones versionadas salvo que la validación las omita', () => {
    const script = readFileSync(startScriptPath, 'utf8')

    expect(script).toContain('SKIP_DB_MIGRATION')
    expect(script).toContain('./node_modules/.bin/prisma migrate deploy')
    expect(script).not.toContain('db:push')
  })
})
