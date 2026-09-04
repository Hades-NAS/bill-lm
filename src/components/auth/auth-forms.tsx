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
  EmailPasswordCredentialsSchema,
  PasswordResetRequestSchema,
  SignUpCredentialsSchema,
} from '#/schema/firebase-auth'

import {
  requestPasswordReset,
  resendEmailVerification,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '#/integrations/firebase/auth'
import { getFirebaseAuthErrorMessage } from '#/integrations/firebase/auth-error'

type AuthFormError = Record<string, Array<string> | undefined>

function GoogleDivider() {
  return <Divider label="o" labelPosition="center" />
}

function GoogleButton({
  onClick,
  loading,
}: {
  onClick: () => void
  loading: boolean
}) {
  return (
    <Button
      fullWidth
      loading={loading}
      type="button"
      variant="default"
      onClick={onClick}
    >
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
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void handleEmailSignIn()
      }}
    >
      <Stack gap="md">
        {formError && (
          <Alert color="red" title="No pudimos iniciar sesión">
            {formError}
          </Alert>
        )}
        {needsVerification && (
          <Alert color="violet" title="Verifica tu correo antes de continuar">
            Revisa tu bandeja de entrada. Cuando completes la verificación,
            vuelve a iniciar sesión.
            <Button
              mt="sm"
              size="xs"
              type="button"
              variant="light"
              onClick={() => resendEmailVerification()}
            >
              Reenviar correo de verificación
            </Button>
          </Alert>
        )}
        <TextInput
          autoComplete="email"
          error={errors.email?.[0]}
          label="Correo electrónico"
          placeholder="tu@correo.com"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
        />
        <PasswordInput
          autoComplete="current-password"
          error={errors.password?.[0]}
          label="Contraseña"
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
        <Button fullWidth loading={loading} type="submit">
          Continuar
        </Button>
        <GoogleDivider />
        <GoogleButton loading={loading} onClick={handleGoogleSignIn} />
        <Group gap="xs" justify="space-between">
          <Anchor component={Link} size="sm" to="/forgot-password">
            ¿Olvidaste tu contraseña?
          </Anchor>
          <Text c="dimmed" size="sm">
            ¿No tienes cuenta?{' '}
            <Anchor component={Link} to="/sign-up">
              Crear cuenta
            </Anchor>
          </Text>
        </Group>
      </Stack>
    </form>
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
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void handleEmailSignUp()
      }}
    >
      <Stack gap="md">
        {verificationSent && (
          <Alert color="violet" title="Revisa tu correo">
            Te enviamos un enlace de verificación. Cuando lo completes, inicia
            sesión para continuar.
          </Alert>
        )}
        {formError && (
          <Alert color="red" title="No pudimos crear la cuenta">
            {formError}
          </Alert>
        )}
        <TextInput
          autoComplete="email"
          error={errors.email?.[0]}
          label="Correo electrónico"
          placeholder="tu@correo.com"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
        />
        <PasswordInput
          autoComplete="new-password"
          error={errors.password?.[0]}
          label="Contraseña"
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
        />
        <PasswordInput
          autoComplete="new-password"
          error={errors.passwordConfirmation?.[0]}
          label="Confirma tu contraseña"
          value={passwordConfirmation}
          onChange={(event) =>
            setPasswordConfirmation(event.currentTarget.value)
          }
        />
        <Button fullWidth loading={loading} type="submit">
          Crear cuenta
        </Button>
        <GoogleDivider />
        <GoogleButton loading={loading} onClick={handleGoogleSignUp} />
        <Text c="dimmed" size="sm" ta="center">
          ¿Ya tienes cuenta?{' '}
          <Anchor component={Link} to="/sign-in">
            Iniciar sesión
          </Anchor>
        </Text>
      </Stack>
    </form>
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
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void handleSubmit()
      }}
    >
      <Stack gap="md">
        {sent && (
          <Alert color="violet" title="Revisa tu correo">
            Si existe una cuenta para este correo, recibirás instrucciones para
            restablecer tu contraseña.
          </Alert>
        )}
        <TextInput
          autoComplete="email"
          error={error}
          label="Correo electrónico"
          placeholder="tu@correo.com"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
        />
        <Button fullWidth loading={loading} type="submit">
          Enviar instrucciones
        </Button>
        <Anchor component={Link} size="sm" ta="center" to="/sign-in">
          Volver a iniciar sesión
        </Anchor>
      </Stack>
    </form>
  )
}
