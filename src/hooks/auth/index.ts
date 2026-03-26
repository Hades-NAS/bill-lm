import { useAuth, useUser } from '@clerk/clerk-react'

import type { AuthType } from '#/schema/auth'

export const useUserAuth = (): AuthType => {
  const { user, isLoaded, isSignedIn } = useUser()
  const { userId } = useAuth()

  return {
    isLoaded,
    isSignedIn,
    userId: userId || '',
    primaryEmail: user?.primaryEmailAddress?.emailAddress || '',
  }
}
