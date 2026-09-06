import { describe, expect, it, vi } from 'vitest'

vi.mock('#/integrations/firebase/auth', () => ({}))
vi.mock('#/integrations/firebase/auth-error', () => ({
  getFirebaseAuthErrorMessage: vi.fn(),
}))
vi.mock('#/hooks/auth', () => ({ useUserAuth: vi.fn() }))

import { shouldNavigateToCollections } from '../auth-forms'

const authenticatedSession = {
  userId: 'firebase-user-1',
  primaryEmail: 'user@example.com',
  isLoaded: true,
  isSignedIn: true,
  isEmailVerified: true,
}

describe('shouldNavigateToCollections', () => {
  it('waits for the auth provider to publish a verified session', () => {
    expect(
      shouldNavigateToCollections(true, {
        ...authenticatedSession,
        isLoaded: false,
      }),
    ).toBe(false)
    expect(
      shouldNavigateToCollections(true, {
        ...authenticatedSession,
        isSignedIn: false,
      }),
    ).toBe(false)
    expect(shouldNavigateToCollections(true, authenticatedSession)).toBe(true)
  })

  it('does not navigate until a sign-in action requests it', () => {
    expect(shouldNavigateToCollections(false, authenticatedSession)).toBe(false)
  })
})
