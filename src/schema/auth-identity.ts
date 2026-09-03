import { z } from 'zod'

export const AuthProviderSchema = z.enum(['firebase'])

export type AuthProvider = z.infer<typeof AuthProviderSchema>

export const AuthIdentityLookupSchema = z.object({
  provider: AuthProviderSchema,
  subject: z.string().min(1),
})

export type AuthIdentityLookup = z.infer<typeof AuthIdentityLookupSchema>

export const AuthIdentityLinkInputSchema = AuthIdentityLookupSchema.extend({
  userId: z.string().min(1),
})

export type AuthIdentityLinkInput = z.infer<typeof AuthIdentityLinkInputSchema>

export const PrincipalSchema = AuthIdentityLinkInputSchema.extend({
  primaryEmail: z.string().email().optional(),
})

export type Principal = z.infer<typeof PrincipalSchema>

export const AuthenticationFailureCodeSchema = z.enum([
  'missing-bearer-token',
  'invalid-token',
  'revoked-token',
  'email-not-verified',
  'identity-not-linked',
  'identity-disabled',
  'identity-orphaned',
])

export type AuthenticationFailureCode = z.infer<
  typeof AuthenticationFailureCodeSchema
>

export const FirebaseIdentityProvisionInputSchema = z.object({
  subject: z.string().min(1),
  primaryEmail: z.string().email(),
})

export type FirebaseIdentityProvisionInput = z.infer<
  typeof FirebaseIdentityProvisionInputSchema
>

export const AuthIdentityResolutionSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('resolved'),
    principal: PrincipalSchema,
  }),
  z.object({
    status: z.literal('missing'),
  }),
  z.object({
    status: z.literal('disabled'),
  }),
  z.object({
    status: z.literal('orphaned'),
  }),
])

export type AuthIdentityResolution = z.infer<
  typeof AuthIdentityResolutionSchema
>
