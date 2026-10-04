import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const publicRoute = readFileSync(
  resolve(import.meta.dirname, '../(public)/route.tsx'),
  'utf8',
)
const privateRoute = readFileSync(
  resolve(import.meta.dirname, '../(private)/route.tsx'),
  'utf8',
)

describe('AppShell route layouts', () => {
  it('does not mount an unused public navbar that can conflict with private navigation', () => {
    expect(publicRoute).not.toContain('navbar={{')
    expect(publicRoute).not.toContain('<AppShell.Navbar')
  })

  it('keeps the private desktop navbar visible', () => {
    expect(privateRoute).toContain(
      'collapsed: { mobile: true, desktop: false }',
    )
    expect(privateRoute).toContain('<AppShell.Navbar')
  })
})
