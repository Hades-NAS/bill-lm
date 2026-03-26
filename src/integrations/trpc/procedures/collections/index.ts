import { TRPCError } from '@trpc/server'
import { DateTime } from 'luxon'

import { WithAuthSchema } from '#/schema/auth'
import {
  AnalyzeCollectionRequestSchema,
  CreateCollectionSchema,
  GetCollectionByIdRequestSchema,
  GetCollectionsRequestSchema,
  UpdateCollectionSchema,
} from '#/schema/collections'

import { adminDb } from '#/integrations/firebase/firebase.server'
import { getServiceLogger } from '#/integrations/logger.server'
import { prisma } from '#/integrations/prisma'
import { AnalyzeQueue } from '#/integrations/queue/analyze-queue'

import { FireCollections } from '#/constants/firebase'

import { privateProcedure } from '../../init'
import { checkAndCreateUser } from '../../middleware/auth'

import type { TRPCRouter } from '#/integrations/trpc/router'
import type { AnalyzeJobData } from '#/schema/collections'
import type { inferRouterOutputs, TRPCRouterRecord } from '@trpc/server'

const logger = getServiceLogger('Collections')

export const collectionsRouter = {
  list: privateProcedure
    .input(WithAuthSchema(GetCollectionsRequestSchema))
    .use(({ input, next }) => checkAndCreateUser({ auth: input.auth, next }))
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
          name: search.name
            ? { contains: search.name, mode: 'insensitive' }
            : undefined,
          year: search.year ? search.year : undefined,
          createdAt: search.createdAt
            ? {
                gte: search.createdAt.from,
                lte: search.createdAt.to,
              }
            : undefined,
        },
        orderBy,
        select: {
          id: true,
          name: true,
          description: true,
          instructions: true,
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
  create: privateProcedure
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
          instructions: data.instructions,
          year: data.year,
        },
      })

      logger.info('Created collection', {
        userId: auth.userId,
        collectionId: collection.id,
      })

      return collection
    }),
  update: privateProcedure
    .input(WithAuthSchema(UpdateCollectionSchema))
    .mutation(async ({ input }) => {
      const { auth, data } = input

      if (!auth.userId) {
        logger.warn('Unauthorized access attempt to update collection', {
          auth,
        })

        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID is required for collections procedures',
        })
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
        data,
      })

      logger.info('Updated collection', {
        userId: auth.userId,
        collectionId: data.id,
      })

      return collection
    }),
  detail: privateProcedure
    .input(WithAuthSchema(GetCollectionByIdRequestSchema))
    .query(async ({ input }) => {
      const { auth, data } = input

      if (!auth.userId) {
        logger.warn('Unauthorized access attempt to get collection detail', {
          auth,
        })

        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID is required for collections procedures',
        })
      }

      logger.info('Fetching collection detail for user', {
        userId: auth.userId,
        collectionId: data.id,
      })

      try {
        const collection = await prisma.collection.findUnique({
          where: {
            id: data.id,
            userId: auth.userId,
          },
          include: {
            bills: {
              orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            },
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
      } catch (error) {
        logger.error(
          `Failed to fetch collection detail from database ${error}`,
          {
            userId: auth.userId,
            collectionId: data.id,
          },
        )

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch collection detail',
        })
      }
    }),
  analyze: privateProcedure
    .input(WithAuthSchema(AnalyzeCollectionRequestSchema))
    .mutation(async ({ input }) => {
      const { auth, data } = input

      if (!auth.userId) {
        logger.warn('Unauthorized access attempt to analyze collection', {
          auth,
        })

        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID is required for collections procedures',
        })
      }

      logger.info('Analyzing collection for user', {
        userId: auth.userId,
        collectionId: data.collectionId,
      })

      const { type, billIds } = data

      const collection = await prisma.collection.findUnique({
        where: {
          id: data.collectionId,
          userId: auth.userId,
        },
      })

      if (!collection) {
        logger.warn('Collection not found for analysis', {
          userId: auth.userId,
          collectionId: data.collectionId,
        })

        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Collection not found',
        })
      }

      let billsToAnalyze: Array<{ id: string }> = []

      if (type === 'all') {
        const bills = await prisma.billHeader.findMany({
          where: {
            collectionId: data.collectionId,
          },
          select: {
            id: true,
          },
        })
        billsToAnalyze = bills
      } else if (type === 'missing') {
        const bills = await prisma.billHeader.findMany({
          where: {
            collectionId: data.collectionId,
            AND: [{ percentage: null }, { reason: null }],
          },
          select: {
            id: true,
          },
        })
        billsToAnalyze = bills
      } else if (type === 'analyzed') {
        const bills = await prisma.billHeader.findMany({
          where: {
            collectionId: data.collectionId,
            OR: [{ percentage: { not: null } }, { reason: { not: null } }],
          },
          select: {
            id: true,
          },
        })
        billsToAnalyze = bills
      } else {
        const bills = await prisma.billHeader.findMany({
          where: {
            collectionId: data.collectionId,
            id: {
              in: billIds,
            },
          },
          select: {
            id: true,
          },
        })
        billsToAnalyze = bills
      }

      if (billsToAnalyze.length === 0) {
        logger.info('No bills to analyze for collection', {
          userId: auth.userId,
          collectionId: data.collectionId,
        })

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'No bills to analyze for the specified collection and criteria',
        })
      }

      const payload: AnalyzeJobData = {
        jobId: crypto.randomUUID(),
        userId: auth.userId,
        data: {
          collectionId: collection.id,
          collectionName: collection.name,
          instructions: collection.instructions || data.instructions,
          preset: data.preset || 'balanced',
          type,
          billIds: billsToAnalyze.map((bill) => bill.id),
        },
        percentage: 0,
        status: 'pending',
        createdAt: DateTime.now().toJSDate(),
        updatedAt: DateTime.now().toJSDate(),
        callCount: 0,
        totalTokens: 0,
      }

      const jobName = `analyze-${data.collectionId}-${payload.jobId}`

      await adminDb
        .collection(FireCollections.ANALYZE_COLLECTION)
        .doc(payload.jobId)
        .set(payload)

      await AnalyzeQueue.add(jobName, payload)

      logger.info('Added analyze job to queue', {
        userId: auth.userId,
        collectionId: data.collectionId,
        jobId: payload.jobId,
        billCount: billsToAnalyze.length,
      })

      return {
        jobId: payload.jobId,
        collectionId: data.collectionId,
        collectionName: collection.name,
      }
    }),
} satisfies TRPCRouterRecord

export type TRPCRouterOutputs = inferRouterOutputs<TRPCRouter>

export type CollectionBaseType =
  TRPCRouterOutputs['collections']['list'][number]
