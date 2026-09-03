import { z } from 'zod'

export const AuthSchema = z.object({
  userId: z.string(),
  primaryEmail: z.string().optional(),
  isLoaded: z.boolean().optional(),
  isSignedIn: z.boolean().optional(),
  isEmailVerified: z.boolean().optional(),
})

export type AuthType = z.infer<typeof AuthSchema>

export const WithAuthSchema = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({
    auth: AuthSchema,
    data: schema,
  })

export type WithAuth<T extends z.ZodTypeAny> = z.infer<
  ReturnType<typeof WithAuthSchema<T>>
>
