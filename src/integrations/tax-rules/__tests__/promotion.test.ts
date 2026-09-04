import { describe, expect, it } from 'vitest'

import { buildReviewedSections, resolveAmbiguousSection } from '../promotion'

const metadata = {
  reviewer: 'Responsable',
  purpose: 'vat_credit' as const,
  taxRegime: 'general' as const,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  reviewedAt: '2026-09-04T00:00:00.000Z',
}

function draft(id: string, reviewStatus: 'draft' | 'ambiguous' = 'draft') {
  return {
    schemaVersion: '1' as const,
    id,
    sourceId: 'ec-sri-lrti',
    articleOrSection: 'Art. 10',
    sourcePages: [1],
    sourceStartOffset: 0,
    sourceEndOffset: 12,
    sourceContentHash: `sha256:${'a'.repeat(64)}`,
    splitterVersion: '1' as const,
    reviewStatus,
    markdown: 'Texto revisable.',
  }
}

describe('buildReviewedSections', () => {
  it('prepares an entire eligible source batch with shared approved metadata', () => {
    const reviewed = buildReviewedSections(
      [draft('ec-sri-lrti-art-10'), draft('ec-sri-lrti-art-11')],
      metadata,
      new Set(),
    )

    expect(reviewed).toHaveLength(2)
    expect(
      reviewed.every((section) => section.reviewStatus === 'reviewed'),
    ).toBe(true)
    expect(
      reviewed.every((section) => section.reviewedBy === 'Responsable'),
    ).toBe(true)
  })

  it('rejects the complete batch before writing when a section is ambiguous or already reviewed', () => {
    expect(() =>
      buildReviewedSections(
        [draft('ec-sri-lrti-art-10'), draft('ec-sri-lrti-art-11', 'ambiguous')],
        metadata,
        new Set(),
      ),
    ).toThrow('requiere revisión de límites')

    expect(() =>
      buildReviewedSections(
        [draft('ec-sri-lrti-art-10')],
        metadata,
        new Set(['ec-sri-lrti-art-10']),
      ),
    ).toThrow('no se sobrescriben revisiones')
  })

  it('records an explicit rationale when resolving one ambiguous section', () => {
    const reviewed = resolveAmbiguousSection(
      draft('ec-sri-rlrti-art-196-part-2', 'ambiguous'),
      {
        ...metadata,
        rationale:
          'Se verificó que este fragmento es un artículo autónomo y su alcance fue clasificado manualmente.',
      },
      new Set(),
    )

    expect(reviewed).toMatchObject({
      id: 'ec-sri-rlrti-art-196-part-2',
      reviewStatus: 'reviewed',
      reviewNotes:
        'Se verificó que este fragmento es un artículo autónomo y su alcance fue clasificado manualmente.',
    })
  })

  it('does not resolve a normal draft or overwrite a reviewed section', () => {
    expect(() =>
      resolveAmbiguousSection(
        draft('ec-sri-lrti-art-10'),
        { ...metadata, rationale: 'No aplica.' },
        new Set(),
      ),
    ).toThrow('usa promote')

    expect(() =>
      resolveAmbiguousSection(
        draft('ec-sri-rlrti-art-196-part-2', 'ambiguous'),
        { ...metadata, rationale: 'No aplica.' },
        new Set(['ec-sri-rlrti-art-196-part-2']),
      ),
    ).toThrow('no se sobrescriben revisiones')
  })
})
