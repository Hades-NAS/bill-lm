import { describe, expect, it } from 'vitest'

import { GetCollectionsRequestSchema } from '../collections'

describe('tRPC business input boundary', () => {
  it('does not accept the former auth wrapper as a collection request', () => {
    const result = GetCollectionsRequestSchema.safeParse({
      auth: { userId: 'another-user' },
      data: {
        search: {},
        sort: {},
      },
    })

    expect(result.success).toBe(false)
  })

  it('drops a forged auth field when the business request is otherwise valid', () => {
    const request = GetCollectionsRequestSchema.parse({
      search: {},
      sort: {},
      auth: { userId: 'another-user' },
    })

    expect(request).not.toHaveProperty('auth')
    expect(request).toMatchObject({
      search: {},
      sort: { field: 'createdAt', direction: 'desc' },
    })
  })
})
