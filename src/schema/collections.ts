import z from 'zod'

import type { FileWithPath } from '@mantine/dropzone'

import { CollectionSchema } from '#/generated/zod'

// COLLECTION CRUD

export const QueryCollectionsRequestSchema = z.object({
  name: z.string().optional(),
  year: z.number().optional(),
  createdAt: z
    .object({
      from: z.date().optional(),
      to: z.date().optional(),
    })
    .optional(),
})

export type QueryCollectionsRequest = z.infer<
  typeof QueryCollectionsRequestSchema
>

export const GetCollectionsRequestSchema = z.object({
  search: QueryCollectionsRequestSchema,
  sort: z.object({
    field: z
      .enum(['name', 'year', 'createdAt'])
      .default('createdAt')
      .optional(),
    direction: z.enum(['asc', 'desc']).default('desc').optional(),
  }),
})

export type GetCollectionsRequest = z.infer<typeof GetCollectionsRequestSchema>

export const GetCollectionByIdRequestSchema = z.object({
  id: z.string(),
})

export type GetCollectionByIdRequest = z.infer<
  typeof GetCollectionByIdRequestSchema
>

export const DeleteCollectionRequestSchema = z.object({
  id: z.string().uuid('La colección a eliminar no es válida'),
})

export type DeleteCollectionRequest = z.infer<
  typeof DeleteCollectionRequestSchema
>

// BILL CRUD

export const UploadBillsRequestSchema = z.object({
  collectionId: z.string(),
  bills: z.array(
    z.object({
      name: z.string(),
      base64: z.string(),
      mimeType: z.enum(['application/pdf', 'text/xml']),
    }),
  ),
})

export type UploadBillsRequest = z.infer<typeof UploadBillsRequestSchema>

export const DeleteBillsRequestSchema = z.object({
  collectionId: z.string(),
  billIds: z.array(z.string()),
})

export type DeleteBillsRequest = z.infer<typeof DeleteBillsRequestSchema>

export const PresetTypeSchema = z.enum(['strict', 'balanced', 'creative'])

export type PresetType = z.infer<typeof PresetTypeSchema>

export const AnalyzeCollectionRequestSchema = z.object({
  collectionId: z.string(),
  collectionName: z.string(),
  instructions: z.string().optional(),
  preset: PresetTypeSchema.default('balanced').optional(),
  type: z.enum(['all', 'missing', 'analyzed', 'specific']),
  billIds: z.array(z.string()),
  credentialId: z.string().uuid().optional(),
})

export type AnalyzeCollectionRequest = z.infer<
  typeof AnalyzeCollectionRequestSchema
>

export const AnalyzeJobDataSchema = z.object({
  data: AnalyzeCollectionRequestSchema,
  jobId: z.string(),
  userId: z.string(),
  // Phase 0 transition contract. It is an opaque reference only: the worker
  // will resolve its secret server-side in Phase 1.
  credentialId: z.string().min(1).nullable(),
  percentage: z.number().min(0).max(100),
  status: z.enum(['pending', 'in-progress', 'completed', 'failed']),
  error: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  // telemetry:
  totalTokens: z.number(),
  callCount: z.number(),
  deletedAt: z.date().nullable(),
  read: z.boolean().default(false),
})

export type AnalyzeJobData = z.infer<typeof AnalyzeJobDataSchema>

export const AnalyzeJobNotificationSchema = AnalyzeJobDataSchema.omit({
  userId: true,
}).extend({
  firebaseUid: z.string().min(1),
})

export type AnalyzeJobNotification = z.infer<
  typeof AnalyzeJobNotificationSchema
>

export const UpdateAnalyzeJobDataSchema = AnalyzeJobDataSchema.partial().extend(
  {
    jobId: AnalyzeJobDataSchema.shape.jobId,
  },
)

export type UpdateAnalyzeJobData = z.infer<typeof UpdateAnalyzeJobDataSchema>

export const GetBillDetailRequestSchema = z.object({
  billId: z.string(),
})

export type GetBillDetailRequest = z.infer<typeof GetBillDetailRequestSchema>

// MODELS
export const CreateCollectionSchema = CollectionSchema.pick({
  name: true,
  description: true,
  instructions: true,
  personalIdNumber: true,
  professionalIdNumber: true,
  year: true,
})
  .extend({
    name: CollectionSchema.shape.name.min(1, 'El nombre es requerido'),
    year: CollectionSchema.shape.year
      .int()
      .min(0, 'El año debe ser un número positivo'),
  })
  .superRefine((data, ctx) => {
    if (data.personalIdNumber && !/^\d+$/.test(data.personalIdNumber)) {
      ctx.addIssue({
        code: 'invalid_value',
        path: ['personalIdNumber'],
        values: [data.personalIdNumber],
        message: 'La cédula personal solo debe contener números',
      })
    }
    if (data.professionalIdNumber && !/^\d+$/.test(data.professionalIdNumber)) {
      ctx.addIssue({
        code: 'invalid_value',
        path: ['professionalIdNumber'],
        values: [data.professionalIdNumber],
        message: 'El RUC solo debe contener números',
      })
    }

    if (data.professionalIdNumber && !data.instructions) {
      ctx.addIssue({
        code: 'invalid_value',
        path: ['instructions'],
        values: [data.instructions],
        message: 'Si se RUC es proporcionado, las instrucciones son requeridas',
      })
    }
    if (data.instructions && !data.professionalIdNumber) {
      ctx.addIssue({
        code: 'invalid_value',
        path: ['professionalIdNumber'],
        values: [data.professionalIdNumber],
        message: 'Si se proporcionan instrucciones, el RUC es requerido',
      })
    }
  })

export type CreateCollectionType = z.infer<typeof CreateCollectionSchema>

export const UpdateCollectionSchema = CreateCollectionSchema.extend({
  id: CollectionSchema.shape.id.min(
    1,
    'El ID es requerido para actualizar una colección',
  ),
})

export type UpdateCollectionType = z.infer<typeof UpdateCollectionSchema>

export const AddBillToCollectionSchema = z.object({
  collectionId: z.string(),
  bills: z.array(z.custom<FileWithPath>()),
})

export type AddBillToCollectionType = z.infer<typeof AddBillToCollectionSchema>
