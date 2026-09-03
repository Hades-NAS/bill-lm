import { z } from 'zod'

export const ProviderConnectionProviderSchema = z.enum(['openai', 'claude'])
export type ProviderConnectionProvider = z.infer<
  typeof ProviderConnectionProviderSchema
>

const ConnectionIdSchema = z.string().uuid()
const SecretSchema = z.string().min(8).max(1000)

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
  label: z.string().trim().min(1).max(100),
  modelId: z.string().trim().min(1).max(255),
  apiKey: SecretSchema,
  makeDefault: z.boolean().default(false),
})
export type CreateProviderConnection = z.infer<
  typeof CreateProviderConnectionSchema
>

export const UpdateProviderConnectionSchema = z.object({
  id: ConnectionIdSchema,
  label: z.string().trim().min(1).max(100).optional(),
  modelId: z.string().trim().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
})
export const RotateProviderConnectionSchema = z.object({
  id: ConnectionIdSchema,
  apiKey: SecretSchema,
})
export const ConnectionIdInputSchema = z.object({ id: ConnectionIdSchema })
