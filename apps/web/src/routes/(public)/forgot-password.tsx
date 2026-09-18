import { createFileRoute } from '@tanstack/react-router'

import { AuthCard } from '#/components/auth/auth-card'
import { PasswordResetForm } from '#/components/auth/auth-forms'

export const Route = createFileRoute('/(public)/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  return (
    <AuthCard
      description="Te enviaremos una forma segura de elegir una nueva contraseña."
      eyebrow="Recuperar acceso"
      title="Restablece tu contraseña"
    >
      <PasswordResetForm />
    </AuthCard>
  )
}
