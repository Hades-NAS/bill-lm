import { TRPCError } from '@trpc/server'
import { DateTime } from 'luxon'
import z from 'zod'

import {
  AnalyzeCollectionRequestSchema,
  CreateCollectionSchema,
  GetCollectionByIdRequestSchema,
  GetCollectionsRequestSchema,
  UpdateCollectionSchema,
  AnalyzeJobNotificationSchema,
} from '#/schema/collections'

import { adminDb } from '#/integrations/firebase/firebase.server'
import { getServiceLogger } from '#/integrations/logger.server'
import { prisma } from '#/integrations/prisma'
import { AnalyzeQueue } from '#/integrations/queue/analyze-queue'

import { FireCollections } from '#/constants/firebase'

import { privateProcedure } from '../../init'

import type { TRPCRouter } from '#/integrations/trpc/router'
import type { AnalyzeJobData } from '#/schema/collections'
import type { inferRouterOutputs, TRPCRouterRecord } from '@trpc/server'

const logger = getServiceLogger('Collections')

const resolveConnection = async (userId: string, requestedId?: string) => {
  const connection = requestedId
    ? await prisma.providerConnection.findFirst({
        where: { id: requestedId, userId, isActive: true, deletedAt: null },
      })
    : await prisma.providerConnection.findFirst({
        where: { userId, isActive: true, isDefault: true, deletedAt: null },
      })
  if (!connection)
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Configura una conexión de proveedor activa antes de analizar.',
    })
  return connection
}

export const collectionsRouter = {
  list: privateProcedure
    .input(GetCollectionsRequestSchema)
    .query(async ({ input: data, ctx }) => {
      const { principal } = ctx

      logger.info('Fetching collections for user', {
        userId: principal.userId,
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
          userId: principal.userId,
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
          personalIdNumber: true,
          professionalIdNumber: true,
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
        userId: principal.userId,
        count: collections.length,
      })

      return collections
    }),
  create: privateProcedure
    .input(CreateCollectionSchema)
    .mutation(async ({ input: data, ctx }) => {
      const { principal } = ctx

      logger.info('Creating collection for user', {
        userId: principal.userId,
        name: data.name,
      })

      const collection = await prisma.collection.create({
        data: {
          userId: principal.userId,
          name: data.name,
          description: data.description,
          instructions: data.instructions,
          personalIdNumber: data.personalIdNumber,
          professionalIdNumber: data.professionalIdNumber,
          year: data.year,
        },
      })

      logger.info('Created collection', {
        userId: principal.userId,
        collectionId: collection.id,
      })

      return collection
    }),
  update: privateProcedure
    .input(UpdateCollectionSchema)
    .mutation(async ({ input: data, ctx }) => {
      const { principal } = ctx

      logger.info('Updating collection for user', {
        userId: principal.userId,
        collectionId: data.id,
      })

      const collection = await prisma.collection.update({
        where: {
          id: data.id,
          userId: principal.userId,
        },
        data,
      })

      logger.info('Updated collection', {
        userId: principal.userId,
        collectionId: data.id,
      })

      return collection
    }),
  detail: privateProcedure
    .input(GetCollectionByIdRequestSchema)
    .query(async ({ input: data, ctx }) => {
      const { principal } = ctx

      logger.info('Fetching collection detail for user', {
        userId: principal.userId,
        collectionId: data.id,
      })

      const collection = await prisma.collection.findUnique({
        where: {
          id: data.id,
          userId: principal.userId,
        },
        include: {
          bills: {
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          },
        },
      })
      if (!collection) {
        logger.warn('Collection not found', {
          userId: principal.userId,
          collectionId: data.id,
        })

        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Collection not found',
        })
      }

      logger.info('Fetched collection detail', {
        userId: principal.userId,
        collectionId: data.id,
      })

      return collection
    }),
  analyze: privateProcedure
    .input(AnalyzeCollectionRequestSchema)
    .mutation(async ({ input: data, ctx }) => {
      const { principal } = ctx

      logger.info('Analyzing collection for user', {
        userId: principal.userId,
        collectionId: data.collectionId,
      })

      const connection = await resolveConnection(
        principal.userId,
        data.credentialId,
      )

      const { type, billIds } = data

      const collection = await prisma.collection.findUnique({
        where: {
          id: data.collectionId,
          userId: principal.userId,
        },
      })

      if (!collection) {
        logger.warn('Collection not found for analysis', {
          userId: principal.userId,
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
          userId: principal.userId,
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
        userId: principal.userId,
        credentialId: connection.id,
        data: {
          collectionId: collection.id,
          collectionName: collection.name,
          instructions: collection.instructions || data.instructions,
          preset: data.preset || 'balanced',
          type,
          billIds: billsToAnalyze.map((bill) => bill.id),
          credentialId: connection.id,
        },
        percentage: 0,
        status: 'pending',
        createdAt: DateTime.now().toJSDate(),
        updatedAt: DateTime.now().toJSDate(),
        callCount: 0,
        totalTokens: 0,
        deletedAt: null,
        read: false,
      }

      const jobName = `analyze-${data.collectionId}-${payload.jobId}`

      const notification = AnalyzeJobNotificationSchema.parse({
        ...payload,
        firebaseUid: principal.subject,
      })

      await adminDb
        .collection(FireCollections.ANALYZE_COLLECTION)
        .doc(payload.jobId)
        .set(notification)

      await AnalyzeQueue.add(jobName, payload)

      logger.info('Added analyze job to queue', {
        userId: principal.userId,
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

  checkUserCanAnalyze: privateProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      const result = await prisma.providerConnection.count({
        where: {
          userId: ctx.principal.userId,
          isActive: true,
          deletedAt: null,
        },
      })

      return {
        canAnalyze: result > 0,
      }
    }),

  markAsRead: privateProcedure
    .input(z.object({}).optional())
    .mutation(async ({ ctx }) => {
      const finalizedJobs = await adminDb
        .collection(FireCollections.ANALYZE_COLLECTION)
        .where('firebaseUid', '==', ctx.principal.subject)
        .where('status', 'not-in', ['pending', 'in-progress'])
        .get()

      const stuckedJobs = await adminDb
        .collection(FireCollections.ANALYZE_COLLECTION)
        .where('firebaseUid', '==', ctx.principal.subject)
        .where('status', 'in', ['pending', 'in-progress'])
        .where('updatedAt', '<=', DateTime.now().minus({ hours: 1 }).toJSDate())
        .get()

      const jobsToClear = [...finalizedJobs.docs, ...stuckedJobs.docs]

      logger.info('Clearing old analyze jobs', {
        count: jobsToClear.length,
      })

      const batch = adminDb.batch()

      jobsToClear.forEach((doc) => {
        batch.update(doc.ref, {
          read: true,
        })
      })

      await batch.commit()

      logger.info('Cleared old analyze jobs', {
        count: jobsToClear.length,
      })
    }),
} satisfies TRPCRouterRecord

export type TRPCRouterOutputs = inferRouterOutputs<TRPCRouter>

export type CollectionBaseType =
  TRPCRouterOutputs['collections']['list'][number]
