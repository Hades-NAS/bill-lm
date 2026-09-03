import { createFileRoute } from '@tanstack/react-router'

import { AuthCard } from '#/components/auth/auth-card'
import { SignInForm } from '#/components/auth/auth-forms'

export const Route = createFileRoute('/(public)/sign-in')({
  component: SignInPage,
})

function SignInPage() {
  return (
    <AuthCard
      description="Accede para organizar y analizar tus facturas de forma clara."
      eyebrow="Iniciar sesión"
      title="Bienvenido de nuevo"
    >
      <SignInForm />
    </AuthCard>
  )
}
