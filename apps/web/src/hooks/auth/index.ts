import { useFirebaseAuthSession } from '#/integrations/firebase/auth-provider'

import type { AuthType } from '#/schema/auth'

export const useUserAuth = (): AuthType => {
  return useFirebaseAuthSession()
}
