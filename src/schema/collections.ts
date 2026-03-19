import z from 'zod'

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
