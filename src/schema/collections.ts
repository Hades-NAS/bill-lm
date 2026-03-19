import z from 'zod'

import { CollectionSchema } from '#/generated/zod'



export const GetCollectionsRequestSchema = z.object({
  search: z.object({
    query: z.string().optional(),
    year: z.number().optional(),
  }),
  sort: z.object({
    field: z.enum(['name', 'year', 'createdAt', 'updatedAt']).default('createdAt').optional(),
    direction: z.enum(['asc', 'desc']).default('desc').optional(),
  }),
})

export type GetCollectionsRequest = z.infer<typeof GetCollectionsRequestSchema>

export const GetCollectionByIdRequestSchema = z.object({
  id: z.string(),
})

export type GetCollectionByIdRequest = z.infer<typeof GetCollectionByIdRequestSchema>

// MODELS
export const CreateCollectionSchema = CollectionSchema.pick({
  name: true,
  description: true,
  year: true,
})

export type CreateCollectionType = z.infer<typeof CreateCollectionSchema>

export const UpdateCollectionSchema = CreateCollectionSchema.extend({
  id: CollectionSchema.shape.id,
})

export type UpdateCollectionType = z.infer<typeof UpdateCollectionSchema>
