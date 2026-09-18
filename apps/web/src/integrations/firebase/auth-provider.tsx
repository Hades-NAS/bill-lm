import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { observeFirebaseAuth } from './auth'

import type { FirebaseAuthSession } from '#/schema/firebase-auth'
import type { ReactNode } from 'react'

const initialSession: FirebaseAuthSession = {
  userId: '',
  primaryEmail: '',
  isLoaded: false,
  isSignedIn: false,
  isEmailVerified: false,
}

const FirebaseAuthContext = createContext<FirebaseAuthSession>(initialSession)

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<FirebaseAuthSession>(initialSession)

  useEffect(() => {
    return observeFirebaseAuth(
      (user) => {
        setSession({
          userId: user?.uid ?? '',
          primaryEmail: user?.email ?? '',
          isLoaded: true,
          isSignedIn: Boolean(user),
          isEmailVerified: Boolean(user?.emailVerified),
        })
      },
      () => setSession({ ...initialSession, isLoaded: true }),
    )
  }, [])

  const value = useMemo(() => session, [session])

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  )
}

export function useFirebaseAuthSession() {
  return useContext(FirebaseAuthContext)
}
