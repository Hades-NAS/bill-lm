import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const routerSource = readFileSync(
  resolve(
    process.cwd(),
    'apps/web/src/integrations/trpc/procedures/collections/index.ts',
  ),
  'utf8',
)

describe('collection soft deletion', () => {
  it('archives collections instead of deleting their audit history', () => {
    expect(routerSource).toContain('prisma.collection.updateMany')
    expect(routerSource).toContain('data: { deletedAt: new Date() }')
    expect(routerSource).not.toContain('prisma.collection.deleteMany')
  })

  it('filters archived collections from active collection operations', () => {
    expect(
      routerSource.match(/deletedAt: null/g)?.length,
    ).toBeGreaterThanOrEqual(6)
  })
})
