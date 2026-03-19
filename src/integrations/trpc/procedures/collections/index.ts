import { WithAuthSchema } from '#/schema/auth'
import { GetCollectionsRequestSchema } from '#/schema/collections'

import { getServiceLogger } from '#/integrations/logger.server'
import { prisma } from '#/integrations/prisma'
import { publicProcedure } from '#/integrations/trpc/init'

import type { TRPCRouterRecord } from '@trpc/server'

const logger = getServiceLogger('Collections')

export const collectionsRouter = {
  list: publicProcedure
    .input(WithAuthSchema(GetCollectionsRequestSchema))
    .query(async ({ input }) => {
      const { auth, data } = input

      logger.info('Fetching collections for user', {
        userId: auth.userId,
        search: data.search,
        sort: data.sort,
      })

      const { search, sort } = data

      let orderBy: Record<string, 'asc' | 'desc'> = {
        createdAt: 'desc',
      }

      if (sort.field && sort.direction) {
        orderBy = {
          [sort.field]: sort.direction,
        }
      }

      const collections = await prisma.collection.findMany({
        where: {
          userId: auth.userId,
          name: search.query ? { contains: search.query } : undefined,
          year: search.year,
        },
        orderBy,
        select: {
          id: true,
          name: true,
          description: true,
          year: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              bills: true,
            },
          },
        },
      })

      logger.info('Fetched collections', {
        userId: auth.userId,
        count: collections.length,
      })

      return collections
    }),
} satisfies TRPCRouterRecord
