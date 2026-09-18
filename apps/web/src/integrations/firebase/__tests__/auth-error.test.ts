import { describe, expect, it } from 'vitest'

import { getFirebaseAuthErrorMessage } from '../auth-error'

describe('getFirebaseAuthErrorMessage', () => {
  it('translates credential errors without leaking account existence', () => {
    expect(getFirebaseAuthErrorMessage({ code: 'auth/user-not-found' })).toBe(
      'Correo o contraseña incorrectos.',
    )
  })

  it('returns a safe generic message for an unknown provider error', () => {
    expect(getFirebaseAuthErrorMessage({ code: 'auth/unknown' })).toBe(
      'No pudimos completar la acción. Inténtalo nuevamente.',
    )
  })
})
