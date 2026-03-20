import z from 'zod'

import type { FileWithPath } from '@mantine/dropzone'

import { CollectionSchema } from '#/generated/zod'

// COLLECTION CRUD

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

// BILL CRUD

export const UploadBillsRequestSchema = z.object({
  collectionId: z.string(),
  bills: z.array(z.object({
    name: z.string(),
    base64: z.string(),
    mimeType: z.enum(['application/pdf', 'text/xml']),
  })),
})

export type UploadBillsRequest = z.infer<typeof UploadBillsRequestSchema>

export const DeleteBillsRequestSchema = z.object({
  collectionId: z.string(),
  billIds: z.array(z.string()),
})

export type DeleteBillsRequest = z.infer<typeof DeleteBillsRequestSchema>

export const AnalyzeCollectionRequestSchema = z.object({
  collectionId: z.string(),
  type: z.enum(['all', 'missing', 'analyzed', 'specific']),
  billIds: z.array(z.string()),
})

export type AnalyzeCollectionRequest = z.infer<typeof AnalyzeCollectionRequestSchema>


// MODELS
export const CreateCollectionSchema = CollectionSchema.pick({
  name: true,
  description: true,
  year: true,
}).extend({
  name: CollectionSchema.shape.name.min(1, 'El nombre es requerido'),
  year: CollectionSchema.shape.year.int().min(0, 'El año debe ser un número positivo'),
})

export type CreateCollectionType = z.infer<typeof CreateCollectionSchema>

export const UpdateCollectionSchema = CreateCollectionSchema.extend({
  id: CollectionSchema.shape.id.min(1, 'El ID es requerido para actualizar una colección'),
})

export type UpdateCollectionType = z.infer<typeof UpdateCollectionSchema>

export const AddBillToCollectionSchema = z.object({
  collectionId: z.string(),
  bills: z.array(z.custom<FileWithPath>()),
})

export type AddBillToCollectionType = z.infer<typeof AddBillToCollectionSchema>
