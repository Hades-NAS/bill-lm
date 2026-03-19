import { TRPCError } from '@trpc/server'

import { WithAuthSchema } from '#/schema/auth'
import { CreateCollectionSchema, GetCollectionByIdRequestSchema, GetCollectionsRequestSchema, UpdateCollectionSchema } from '#/schema/collections'

import { getServiceLogger } from '#/integrations/logger.server'
import { prisma } from '#/integrations/prisma'
import { publicProcedure } from '#/integrations/trpc/init'

import type { TRPCRouter } from '#/integrations/trpc/router'
import type { AuthType } from '#/schema/auth';
import type { inferRouterOutputs, TRPCRouterRecord } from '@trpc/server';

const logger = getServiceLogger('Collections')

const checkAndCreateUser = async (auth: AuthType) => {
  if (!auth.userId) {
    logger.warn('Unauthorized access attempt to collections procedure', {
      auth,
    })
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User ID is required for collections procedures',
    })
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      id: auth.userId,
    },
  })

  if (!existingUser) {
    logger.info('Creating user for authenticated request', {
      userId: auth.userId,
      email: auth.primaryEmail,
    })

    await prisma.user.create({
      data: {
        id: auth.userId,
        primaryEmail: auth.primaryEmail,
      },
    })
  }

  return true
}

export const collectionsRouter = {
  list: publicProcedure
    .input(WithAuthSchema(GetCollectionsRequestSchema))
    .use(async ({ input, next }) => {
      const { auth } = input

      await checkAndCreateUser(auth)

      return next({ input })
    })
    .query(async ({ input }) => {
      const { auth, data } = input

      if (!auth.userId) {
        logger.warn('Unauthorized access attempt to list collections', {
          auth,
        })

        return []
      }

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
  create: publicProcedure
    .input(WithAuthSchema(CreateCollectionSchema))
    .mutation(async ({ input }) => {
      const { auth, data } = input

      if (!auth.userId) {
        logger.warn('Unauthorized access attempt to create collection', {
          auth,
        })

        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID is required for collections procedures',
        })
      }

      logger.info('Creating collection for user', {
        userId: auth.userId,
        name: data.name,
      })

      const collection = await prisma.collection.create({
        data: {
          userId: auth.userId,
          name: data.name,
          description: data.description,
          year: data.year,
        },
      })

      logger.info('Created collection', {
        userId: auth.userId,
        collectionId: collection.id,
      })

      return collection
    }),
  update: publicProcedure
    .input(WithAuthSchema(UpdateCollectionSchema))
    .mutation(async ({ input }) => {
      const { auth, data } = input

      if (!auth.userId) {
        logger.warn('Unauthorized access attempt to update collection', {
          auth,
        })

        throw new Error('Unauthorized')
      }

      logger.info('Updating collection for user', {
        userId: auth.userId,
        collectionId: data.id,
      })

      const collection = await prisma.collection.update({
        where: {
          id: data.id,
          userId: auth.userId,
        },
        data: {
          name: data.name,
          description: data.description,
          year: data.year,
        },
      })

      logger.info('Updated collection', {
        userId: auth.userId,
        collectionId: data.id,
      })

      return collection
    }),
  detail: publicProcedure
    .input(WithAuthSchema(GetCollectionByIdRequestSchema))
    .query(async ({ input }) => {
      const { auth, data } = input

      if (!auth.userId) {
        logger.warn('Unauthorized access attempt to get collection detail', {
          auth,
        })

        throw new Error('Unauthorized')
      }

      logger.info('Fetching collection detail for user', {
        userId: auth.userId,
        collectionId: data.id,
      })

      const collection = await prisma.collection.findUnique({
        where: {
          id: data.id,
          userId: auth.userId,
        },
        include: {
          bills: true,
        },
      })

      if (!collection) {
        logger.warn('Collection not found', {
          userId: auth.userId,
          collectionId: data.id,
        })

        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Collection not found',
        })
      }

      logger.info('Fetched collection detail', {
        userId: auth.userId,
        collectionId: data.id,
      })

      return collection
    }),
} satisfies TRPCRouterRecord

export type TRPCRouterOutputs = inferRouterOutputs<TRPCRouter>

export type CollectionBaseType = TRPCRouterOutputs['collections']['list'][number]
