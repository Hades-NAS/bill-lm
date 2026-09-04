import { describe, expect, it } from 'vitest'

import { CreateCollectionSchema, UpdateCollectionSchema } from '#/schema/collections'

const validCollection = {
  name: 'Declaración 2026',
  description: null,
  instructions: null,
  personalIdNumber: '0102030405',
  professionalIdNumber: '',
  year: 2026,
}

describe('collection input schemas', () => {
  it('validates collection input without importing generated Prisma Zod schemas', () => {
    expect(CreateCollectionSchema.parse(validCollection)).toEqual(validCollection)
  })

  it('keeps the collection business validation at the API boundary', () => {
    const result = UpdateCollectionSchema.safeParse({
      ...validCollection,
      id: 'not-a-uuid',
      professionalIdNumber: '0999999999001',
      instructions: null,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path)).toEqual(
        expect.arrayContaining([['id'], ['instructions']]),
      )
    }
  })
})
