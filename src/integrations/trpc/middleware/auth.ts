import { TRPCError } from "@trpc/server"
import { TRPC_ERROR_CODES_BY_KEY } from "@trpc/server/unstable-core-do-not-import"

import { getServiceLogger } from "#/integrations/logger.server"
import { prisma } from "#/integrations/prisma"

import type { AuthType } from "#/schema/auth"
import type { MiddlewareResult } from "@trpc/server/unstable-core-do-not-import";

const logger = getServiceLogger('AuthMiddleware')

type AuthMiddlewareParam = {
  auth?: AuthType,
  next: () => Promise<MiddlewareResult<object>>,
}

export const checkAndCreateUser = async ({ auth, next }: AuthMiddlewareParam): Promise<MiddlewareResult<object>> => {

  if (auth) {
  }
  logger.warn('Unauthorized access attempt to collections procedure', {
    auth,
  })

  throw new TRPCError({
    code: 'UNAUTHORIZED',
    message: 'User ID is required for collections procedures',
  })
  return next()

  // const existingUser = await prisma.user.findUnique({
  //   where: {
  //     id: auth.userId,
  //   },
  // })

  // if (!existingUser) {
  //   logger.info('Creating user for authenticated request', {
  //     userId: auth.userId,
  //     email: auth.primaryEmail,
  //   })

  //   await prisma.user.create({
  //     data: {
  //       id: auth.userId,
  //       primaryEmail: auth.primaryEmail,
  //     },
  //   })
  // }

  return next()
}