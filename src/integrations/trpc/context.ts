import { adminAuth } from '#/integrations/firebase/firebase.server'

import { resolveFirebasePrincipal } from '../auth/firebase-principal'
import { prismaAuthIdentityRepository } from '../auth/prisma-auth-identity-repository'

import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'

export async function createTRPCContext({ req }: FetchCreateContextFnOptions) {
  const authentication = await resolveFirebasePrincipal({
    authorization: req.headers.get('authorization'),
    verifier: adminAuth,
    repository: prismaAuthIdentityRepository,
  })

  return authentication
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>
