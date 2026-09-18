import { z } from 'zod'

export const LocalConnectionIdSchema = z.string().uuid('La conexión local no es válida.')
export type LocalConnectionId = z.infer<typeof LocalConnectionIdSchema>

export const LocalApiFlavorSchema = z.enum(['openai-like', 'claude-like'])
export type LocalApiFlavor = z.infer<typeof LocalApiFlavorSchema>

export const LocalSecretReferenceSchema = z
  .string()
  .trim()
  .min(1, 'La referencia del secreto no puede estar vacía.')
  .max(500, 'La referencia del secreto no puede superar los 500 caracteres.')
  .regex(/^(keychain|env):/, 'Usa una referencia keychain: o env:, nunca el secreto directamente.')

export const CreateLocalConnectionSchema = z.object({
  label: z.string().trim().min(1, 'Ingresa un nombre para la conexión local.').max(100, 'El nombre no puede superar los 100 caracteres.'),
  apiFlavor: LocalApiFlavorSchema,
  baseUrl: z.url('Ingresa una URL base válida.').refine((value) => value.startsWith('http://') || value.startsWith('https://'), 'La URL base debe usar HTTP o HTTPS.'),
  model: z.string().trim().min(1, 'Ingresa el identificador del modelo.').max(255, 'El modelo no puede superar los 255 caracteres.'),
  secretRef: LocalSecretReferenceSchema.optional(),
  makeDefault: z.boolean().default(false),
})
export type CreateLocalConnection = z.infer<typeof CreateLocalConnectionSchema>

export const LocalConnectionSchema = CreateLocalConnectionSchema.omit({ makeDefault: true }).extend({
  id: LocalConnectionIdSchema,
  isDefault: z.boolean(),
  lastProbedAt: z.date().nullable(),
  lastProbeError: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})
export type LocalConnection = z.infer<typeof LocalConnectionSchema>

export const OauthGuidanceSchema = z.object({
  kind: z.literal('oauth-guidance'),
  title: z.literal('Continúa con OAuth'),
  message: z.string().min(1),
})
export type OauthGuidance = z.infer<typeof OauthGuidanceSchema>

export const GpuAnalysisAvailabilitySchema = z.object({
  kind: z.literal('gpu-ready'),
  connectionId: LocalConnectionIdSchema,
})
export type GpuAnalysisAvailability = z.infer<typeof GpuAnalysisAvailabilitySchema>

export const LocalAnalysisAvailabilitySchema = z.discriminatedUnion('kind', [OauthGuidanceSchema, GpuAnalysisAvailabilitySchema])
export type LocalAnalysisAvailability = z.infer<typeof LocalAnalysisAvailabilitySchema>

const noConnectionGuidance: OauthGuidance = {
  kind: 'oauth-guidance',
  title: 'Continúa con OAuth',
  message: 'No hay una conexión local configurada. Próximamente podrás continuar este análisis con OAuth.',
}

export function resolveLocalAnalysisAvailability(
  connections: ReadonlyArray<LocalConnection>,
  selectedConnectionId?: string | null,
): LocalAnalysisAvailability {
  const selected = selectedConnectionId
    ? connections.find((connection) => connection.id === selectedConnectionId)
    : (connections.find((connection) => connection.isDefault) ?? connections[0])
  return selected ? { kind: 'gpu-ready', connectionId: selected.id } : noConnectionGuidance
}
