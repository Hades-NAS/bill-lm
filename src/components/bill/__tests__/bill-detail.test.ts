import { describe, expect, it } from 'vitest'

import { getAnalysisResult } from '../bill-detail'

const id = '11111111-1111-4111-8111-111111111111'

describe('BillDetail canonical result notice', () => {
  it('exposes the canonical no-dictamen notice from a persisted V2 snapshot', () => {
    const result = getAnalysisResult({
      schemaVersion: 'v2',
      runId: id,
      invoiceId: id,
      purpose: 'personal_expenses',
      classification: 'needs_review',
      reasoning: 'Falta evidencia.',
      uncertainties: ['Soporte'],
      advisoryNotice:
        'Resultado orientativo; no constituye un dictamen jurídico ni una determinación del SRI.',
      references: {
        official: [
          {
            sourceId: id,
            sourceContentHash: 'source',
            fragmentId: id,
            fragmentContentHash: 'fragment',
            articleOrSection: 'Art. 1',
          },
        ],
        user: [],
      },
      missingEvidence: ['Soporte'],
      createdAt: '2026-09-05T00:00:00.000Z',
    })

    expect(result?.advisoryNotice).toContain(
      'no constituye un dictamen jurídico',
    )
    expect(result?.classification).toBe('needs_review')
  })
})
