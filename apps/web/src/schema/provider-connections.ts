import { z } from 'zod'

export const ProviderConnectionProviderSchema = z.enum(['openai', 'claude'])
export type ProviderConnectionProvider = z.infer<
  typeof ProviderConnectionProviderSchema
>

const ConnectionIdSchema = z
  .string()
  .uuid('La conexión seleccionada no es válida.')
const SecretSchema = z
  .string()
  .min(8, 'Ingresa una API key válida de al menos 8 caracteres.')
  .max(1_000, 'La API key no puede superar los 1.000 caracteres.')

export const ProviderConnectionPublicSchema = z.object({
  id: ConnectionIdSchema,
  provider: z.enum(['OPENAI', 'CLAUDE']),
  label: z.string(),
  modelId: z.string(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  secretLastFour: z.string().length(4),
  probedAt: z.date().nullable(),
  lastProbeError: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type ProviderConnectionPublic = z.infer<
  typeof ProviderConnectionPublicSchema
>

export const CreateProviderConnectionSchema = z.object({
  provider: ProviderConnectionProviderSchema,
  label: z
    .string()
    .trim()
    .min(1, 'Ingresa un nombre para la conexión.')
    .max(100, 'El nombre no puede superar los 100 caracteres.'),
  modelId: z
    .string()
    .trim()
    .min(1, 'Ingresa el identificador del modelo.')
    .max(255, 'El modelo no puede superar los 255 caracteres.'),
  apiKey: SecretSchema,
  makeDefault: z.boolean().default(false),
})
export type CreateProviderConnection = z.infer<
  typeof CreateProviderConnectionSchema
>

export const UpdateProviderConnectionSchema = z.object({
  id: ConnectionIdSchema,
  label: z
    .string()
    .trim()
    .min(1, 'Ingresa un nombre para la conexión.')
    .max(100, 'El nombre no puede superar los 100 caracteres.')
    .optional(),
  modelId: z
    .string()
    .trim()
    .min(1, 'Ingresa el identificador del modelo.')
    .max(255, 'El modelo no puede superar los 255 caracteres.')
    .optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
})
export const RotateProviderConnectionSchema = z.object({
  id: ConnectionIdSchema,
  apiKey: SecretSchema,
})
export const ConnectionIdInputSchema = z.object({ id: ConnectionIdSchema })
