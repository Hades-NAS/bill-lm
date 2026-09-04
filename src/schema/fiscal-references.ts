import z from 'zod'

export const FISCAL_REFERENCE_MAX_FILES = 3
export const FISCAL_REFERENCE_MAX_BYTES = 5 * 1024 * 1024
export const FISCAL_REFERENCE_MAX_NORMALIZED_CHARS = 20_000

export const FiscalReferenceFileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Selecciona un archivo de referencia.')
    .max(255, 'El nombre del archivo no puede superar los 255 caracteres.'),
  base64: z.string().min(1, 'No pudimos leer el archivo seleccionado.'),
  mimeType: z.enum(['application/pdf', 'text/markdown', 'text/plain'], {
    error: 'Selecciona un PDF, Markdown o archivo de texto.',
  }),
})

export const UploadFiscalReferenceSchema = z.object({
  file: FiscalReferenceFileSchema,
})

export const FiscalReferenceIdSchema = z.object({
  id: z.string().uuid('La referencia seleccionada no es válida.'),
})

export type UploadFiscalReference = z.infer<typeof UploadFiscalReferenceSchema>
