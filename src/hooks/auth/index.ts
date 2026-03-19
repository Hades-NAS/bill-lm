import { useAuth, useUser } from "@clerk/clerk-react"

import type { AuthType } from "#/schema/auth"

export const useUserAuth = (): AuthType => {
  const { user } = useUser()
  const { userId } = useAuth()

  return {
    userId: userId || '',
    primaryEmail: user?.primaryEmailAddress?.emailAddress || '',
  }
}
