import { FirebaseAuthErrorCodeSchema } from '#/schema/firebase-auth'

export function getFirebaseAuthErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? FirebaseAuthErrorCodeSchema.safeParse(String(error.code))
      : null

  switch (code?.success ? code.data : '') {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos.'
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con este correo.'
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return 'Elige una contraseña más segura.'
    case 'auth/popup-closed-by-user':
      return 'Se cerró la ventana de Google. Puedes intentarlo de nuevo.'
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana de Google. Habilita popups e inténtalo otra vez.'
    case 'auth/too-many-requests':
      return 'Hubo demasiados intentos. Espera un momento y vuelve a probar.'
    default:
      return 'No pudimos completar la acción. Inténtalo nuevamente.'
  }
}
