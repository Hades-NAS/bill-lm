import { useAuth, useUser } from "@clerk/clerk-react"

import type { AuthType } from "#/schema/auth"

export const useUserAuth = (): AuthType => {
  const { user } = useUser()
  const { userId } = useAuth()

  if (!user || !userId) {
    throw new Error('User is not authenticated')
  }

  return { userId, primaryEmail: user.primaryEmailAddress?.emailAddress || '' }
}
