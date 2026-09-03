import z from 'zod'

export const FISCAL_REFERENCE_MAX_FILES = 3
export const FISCAL_REFERENCE_MAX_BYTES = 5 * 1024 * 1024
export const FISCAL_REFERENCE_MAX_NORMALIZED_CHARS = 20_000

export const FiscalReferenceFileSchema = z.object({
  name: z.string().trim().min(1).max(255),
  base64: z.string().min(1),
  mimeType: z.enum(['application/pdf', 'text/markdown', 'text/plain']),
})

export const UploadFiscalReferenceSchema = z.object({
  file: FiscalReferenceFileSchema,
})

export const FiscalReferenceIdSchema = z.object({
  id: z.string().uuid(),
})

export type UploadFiscalReference = z.infer<
  typeof UploadFiscalReferenceSchema
>
