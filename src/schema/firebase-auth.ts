import { z } from 'zod'

export const EmailPasswordCredentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('Ingresa un correo válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export type EmailPasswordCredentials = z.infer<
  typeof EmailPasswordCredentialsSchema
>

export const SignUpCredentialsSchema = EmailPasswordCredentialsSchema.extend({
  passwordConfirmation: z.string().min(1, 'Confirma tu contraseña'),
}).refine((value) => value.password === value.passwordConfirmation, {
  message: 'Las contraseñas no coinciden',
  path: ['passwordConfirmation'],
})

export type SignUpCredentials = z.infer<typeof SignUpCredentialsSchema>

export const PasswordResetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email('Ingresa un correo válido'),
})

export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>

export const FirebaseAuthSessionSchema = z.object({
  userId: z.string(),
  primaryEmail: z.string().email().or(z.literal('')),
  isLoaded: z.boolean(),
  isSignedIn: z.boolean(),
  isEmailVerified: z.boolean(),
})

export type FirebaseAuthSession = z.infer<typeof FirebaseAuthSessionSchema>

export const FirebaseAuthErrorCodeSchema = z.string().startsWith('auth/')

export type FirebaseAuthErrorCode = z.infer<typeof FirebaseAuthErrorCodeSchema>
