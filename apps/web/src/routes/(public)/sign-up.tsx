import { createFileRoute } from '@tanstack/react-router'

import { AuthCard } from '#/components/auth/auth-card'
import { SignUpForm } from '#/components/auth/auth-forms'

export const Route = createFileRoute('/(public)/sign-up')({
  component: SignUpPage,
})

function SignUpPage() {
  return (
    <AuthCard
      description="Primero crea tu acceso. Luego configuraremos cómo quieres analizar tus facturas."
      eyebrow="Crear cuenta"
      title="Empieza con tranquilidad"
    >
      <SignUpForm />
    </AuthCard>
  )
}
