import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'

import { getServiceLogger } from '../logger.server'

import type { TRPCContext } from './context'

const logger = getServiceLogger('Trpc')

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    logger.error('tRPC Error Global', {
      code: shape.code,
      message: shape.message,
      path: shape.data.path,
      cause: error.cause,
    })
    return shape
  },
})

export const createTRPCRouter = t.router
export const publicProcedure = t.procedure


const errorLoggingMiddleware = t.middleware(async ({ next, path }) => {
  try {
    return await next()
  } catch (error) {
    logger.error('Unhandled error in privateProcedure', {
      path,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })

    // Re-lanzar para que tRPC maneje la respuesta
    throw error
  }
})

const requirePrincipal = t.middleware(({ ctx, next }) => {
  if (!ctx.principal) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: ctx.failure,
    })
  }

  return next({
    ctx: {
      principal: ctx.principal,
    },
  })
})

export const privateProcedure = t.procedure
  .use(errorLoggingMiddleware)
  .use(requirePrincipal)
