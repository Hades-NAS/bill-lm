import { describe, expect, it } from 'vitest'

import { diffTaxRuleSections, splitTaxRuleSource } from '../sectioning'

const source = {
  id: 'ec-sri-rlrti',
  sourceKind: 'regulation' as const,
  contentHash: `sha256:${'a'.repeat(64)}`,
}

describe('tax rule sectioning', () => {
  it('splits articles while retaining page and source offsets', () => {
    const sections = splitTaxRuleSource(
      source,
      'Art. 10.- Base imponible\nTexto A\n\n<!-- page 2 of 2 -->\n\nArt. 11.- Tarifa\nTexto B\n',
    )
    expect(sections).toHaveLength(2)
    expect(sections[0]).toMatchObject({ id: 'ec-sri-rlrti-art-10-base-imponible', sourcePages: [1, 2] })
    expect(sections[1]).toMatchObject({ id: 'ec-sri-rlrti-art-11-tarifa', sourcePages: [2], reviewStatus: 'draft' })
  })

  it('marks an unrecognizable structure as ambiguous rather than inventing sections', () => {
    expect(splitTaxRuleSource(source, 'Texto sin encabezados utilizables')).toMatchObject([
      { reviewStatus: 'ambiguous', id: 'ec-sri-rlrti-unresolved-structure' },
    ])
  })

  it('distinguishes textual changes from page-only changes', () => {
    const [draft] = splitTaxRuleSource(source, 'Art. 10.- Base imponible\nTexto A')
    const reviewed = {
      ...draft,
      sourcePages: [2],
      purposes: ['vat_credit' as const],
      taxRegimes: ['general' as const],
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      reviewStatus: 'reviewed' as const,
      reviewedBy: 'owner',
      reviewedAt: '2026-01-01T00:00:00.000Z',
    }
    expect(diffTaxRuleSections([draft], [reviewed])).toMatchObject({ pageOnlyChanged: [draft.id] })
  })
})
