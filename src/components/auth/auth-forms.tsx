import {
  Alert,
  Anchor,
  Button,
  Divider,
  Group,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import {
  requestPasswordReset,
  resendEmailVerification,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '#/integrations/firebase/auth'
import { getFirebaseAuthErrorMessage } from '#/integrations/firebase/auth-error'
import {
  EmailPasswordCredentialsSchema,
  PasswordResetRequestSchema,
  SignUpCredentialsSchema,
} from '#/schema/firebase-auth'

type AuthFormError = Record<string, string[] | undefined>

function GoogleDivider() {
  return <Divider label="o" labelPosition="center" />
}

function GoogleButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <Button fullWidth loading={loading} variant="default" onClick={onClick}>
      Continuar con Google
    </Button>
  )
}

export function SignInForm() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<AuthFormError>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)

  const continueWithCredential = async (emailVerified: boolean) => {
    if (!emailVerified) {
      setNeedsVerification(true)
      return
    }
    await navigate({ to: '/collections' })
  }

  const handleEmailSignIn = async () => {
    const parsed = EmailPasswordCredentialsSchema.safeParse({ email, password })
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors)
      return
    }

    setLoading(true)
    setErrors({})
    setFormError(null)
    try {
      const credential = await signInWithEmail(parsed.data)
      await continueWithCredential(credential.user.emailVerified)
    } catch (error) {
      setFormError(getFirebaseAuthErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setFormError(null)
    try {
      const credential = await signInWithGoogle()
      await continueWithCredential(credential.user.emailVerified)
    } catch (error) {
      setFormError(getFirebaseAuthErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Stack gap="md">
      {formError && <Alert color="red" title="No pudimos iniciar sesión">{formError}</Alert>}
      {needsVerification && (
        <Alert color="violet" title="Verifica tu correo antes de continuar">
          Revisa tu bandeja de entrada. Cuando completes la verificación, vuelve a iniciar sesión.
          <Button mt="sm" size="xs" variant="light" onClick={() => resendEmailVerification()}>
            Reenviar correo de verificación
          </Button>
        </Alert>
      )}
      <TextInput
        autoComplete="email"
        error={errors.email?.[0]}
        label="Correo electrónico"
        onChange={(event) => setEmail(event.currentTarget.value)}
        placeholder="tu@correo.com"
        value={email}
      />
      <PasswordInput
        autoComplete="current-password"
        error={errors.password?.[0]}
        label="Contraseña"
        onChange={(event) => setPassword(event.currentTarget.value)}
        value={password}
      />
      <Button fullWidth loading={loading} onClick={handleEmailSignIn} type="button">
        Continuar
      </Button>
      <GoogleDivider />
      <GoogleButton loading={loading} onClick={handleGoogleSignIn} />
      <Group justify="space-between" gap="xs">
        <Anchor component={Link} size="sm" to="/forgot-password">
          ¿Olvidaste tu contraseña?
        </Anchor>
        <Text c="dimmed" size="sm">
          ¿No tienes cuenta?{' '}
          <Anchor component={Link} to="/sign-up">Crear cuenta</Anchor>
        </Text>
      </Group>
    </Stack>
  )
}

export function SignUpForm() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [errors, setErrors] = useState<AuthFormError>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)

  const handleEmailSignUp = async () => {
    const parsed = SignUpCredentialsSchema.safeParse({
      email,
      password,
      passwordConfirmation,
    })
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors)
      return
    }

    setLoading(true)
    setErrors({})
    setFormError(null)
    try {
      await signUpWithEmail(parsed.data)
      setVerificationSent(true)
    } catch (error) {
      setFormError(getFirebaseAuthErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    setLoading(true)
    setFormError(null)
    try {
      const credential = await signInWithGoogle()
      if (!credential.user.emailVerified) {
        setFormError('Verifica tu correo de Google antes de continuar.')
        return
      }
      await navigate({ to: '/collections' })
    } catch (error) {
      setFormError(getFirebaseAuthErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Stack gap="md">
      {verificationSent && (
        <Alert color="violet" title="Revisa tu correo">
          Te enviamos un enlace de verificación. Cuando lo completes, inicia sesión para continuar.
        </Alert>
      )}
      {formError && <Alert color="red" title="No pudimos crear la cuenta">{formError}</Alert>}
      <TextInput autoComplete="email" error={errors.email?.[0]} label="Correo electrónico" onChange={(event) => setEmail(event.currentTarget.value)} placeholder="tu@correo.com" value={email} />
      <PasswordInput autoComplete="new-password" error={errors.password?.[0]} label="Contraseña" onChange={(event) => setPassword(event.currentTarget.value)} value={password} />
      <PasswordInput autoComplete="new-password" error={errors.passwordConfirmation?.[0]} label="Confirma tu contraseña" onChange={(event) => setPasswordConfirmation(event.currentTarget.value)} value={passwordConfirmation} />
      <Button fullWidth loading={loading} onClick={handleEmailSignUp} type="button">
        Crear cuenta
      </Button>
      <GoogleDivider />
      <GoogleButton loading={loading} onClick={handleGoogleSignUp} />
      <Text c="dimmed" size="sm" ta="center">
        ¿Ya tienes cuenta? <Anchor component={Link} to="/sign-in">Iniciar sesión</Anchor>
      </Text>
    </Stack>
  )
}

export function PasswordResetForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    const parsed = PasswordResetRequestSchema.safeParse({ email })
    if (!parsed.success) {
      setError(parsed.error.flatten().fieldErrors.email?.[0] ?? null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      await requestPasswordReset(parsed.data)
      setSent(true)
    } catch {
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Stack gap="md">
      {sent && <Alert color="violet" title="Revisa tu correo">Si existe una cuenta para este correo, recibirás instrucciones para restablecer tu contraseña.</Alert>}
      <TextInput autoComplete="email" error={error} label="Correo electrónico" onChange={(event) => setEmail(event.currentTarget.value)} placeholder="tu@correo.com" value={email} />
      <Button fullWidth loading={loading} onClick={handleSubmit} type="button">Enviar instrucciones</Button>
      <Anchor component={Link} size="sm" ta="center" to="/sign-in">Volver a iniciar sesión</Anchor>
    </Stack>
  )
}
