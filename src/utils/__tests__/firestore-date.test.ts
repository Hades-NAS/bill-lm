import { describe, expect, it } from 'vitest'

import { toDate } from '../firestore-date'

describe('toDate', () => {
  it('falls back to a valid Date when persisted data is malformed', () => {
    const date = toDate('not-a-date')

    expect(Number.isNaN(date.getTime())).toBe(false)
  })

  it('preserves valid ISO dates from persisted browser storage', () => {
    const date = toDate('2026-09-06T11:00:00.000Z')

    expect(date.toISOString()).toBe('2026-09-06T11:00:00.000Z')
  })
})
