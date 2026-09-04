import { TRPCError } from '@trpc/server'
import { DateTime } from 'luxon'
import z from 'zod'

import {
  AnalyzeCollectionRequestSchema,
  CreateCollectionSchema,
  DeleteCollectionRequestSchema,
  GetCollectionByIdRequestSchema,
  GetCollectionsRequestSchema,
  UpdateCollectionSchema,
  AnalyzeJobNotificationSchema,
} from '#/schema/collections'
import {
  CollectionContextRevisionInputSchema,
  collectionContextBlocks,
  TaxpayerProfileContextSchema,
} from '#/schema/tax-analysis-v2'

import { adminDb } from '#/integrations/firebase/firebase.server'
import { canAnalyzeWithRequirements } from '#/integrations/fiscal-references/normalizer.server'
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

const CollectionContextInputSchema =
  CollectionContextRevisionInputSchema.extend({
    collectionId: z.string().uuid(),
  })

const isCompatibleVatPeriod = (
  startDate: string,
  endDate: string,
  frequency: 'monthly' | 'semiannual',
) => {
  const start = DateTime.fromISO(startDate, { zone: 'utc' })
  const end = DateTime.fromISO(endDate, { zone: 'utc' })
  if (!start.isValid || !end.isValid) return false
  if (frequency === 'monthly')
    return (
      start.startOf('month').toISODate() === startDate &&
      end.endOf('month').toISODate() === endDate
    )
  const semesterStart = start.month === 1 || start.month === 7
  const semesterEnd = start.month === 6 || start.month === 12
  return (
    semesterStart &&
    semesterEnd &&
    start.day === 1 &&
    end.day === end.endOf('month').day &&
    start.year === end.year
  )
}

const persistBlockedRun = (input: {
  userId: string
  collectionId: string
  code: string
  message: string
  contextRevisionId?: string
  taxpayerProfileRevisionId?: string
}) =>
  prisma.analysisRun.create({
    data: {
      userId: input.userId,
      collectionId: input.collectionId,
      collectionContextRevisionId: input.contextRevisionId,
      taxpayerProfileRevisionId: input.taxpayerProfileRevisionId,
      promptVersion: 'v2',
      inputSnapshot: { schemaVersion: 'v2', blockCode: input.code },
      idempotencyKey: crypto.randomUUID(),
      status: 'blocked',
      blockCode: input.code,
      blockMessage: input.message,
    },
  })

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
  delete: privateProcedure
    .input(DeleteCollectionRequestSchema)
    .mutation(async ({ input, ctx }) => {
      const { principal } = ctx

      logger.info('Deleting collection for user', {
        userId: principal.userId,
        collectionId: input.id,
      })

      const result = await prisma.collection.deleteMany({
        where: {
          id: input.id,
          userId: principal.userId,
        },
      })

      if (result.count === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'La colección no existe o ya fue eliminada.',
        })
      }

      logger.info('Deleted collection for user', {
        userId: principal.userId,
        collectionId: input.id,
      })

      return { id: input.id }
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
  listContextRevisions: privateProcedure
    .input(GetCollectionByIdRequestSchema)
    .query(async ({ input, ctx }) => {
      const collection = await prisma.collection.findFirst({
        where: { id: input.id, userId: ctx.principal.userId },
        select: { id: true },
      })
      if (!collection)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Colección no encontrada.',
        })
      return prisma.collectionContextRevision.findMany({
        where: { collectionId: collection.id, userId: ctx.principal.userId },
        include: { activities: true, taxpayerProfileRevision: true },
        orderBy: { revision: 'desc' },
      })
    }),
  listAnalysisRuns: privateProcedure
    .input(GetCollectionByIdRequestSchema)
    .query(async ({ input, ctx }) => {
      const collection = await prisma.collection.findFirst({
        where: { id: input.id, userId: ctx.principal.userId },
        select: { id: true },
      })
      if (!collection)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Colección no encontrada.',
        })
      return prisma.analysisRun.findMany({
        where: { collectionId: collection.id, userId: ctx.principal.userId },
        select: {
          id: true,
          status: true,
          blockCode: true,
          blockMessage: true,
          provider: true,
          modelId: true,
          promptVersion: true,
          createdAt: true,
          completedAt: true,
          results: {
            select: {
              billId: true,
              purpose: true,
              classification: true,
              resultSnapshot: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
    }),
  createContextRevision: privateProcedure
    .input(CollectionContextInputSchema)
    .mutation(async ({ input, ctx }) => {
      const collection = await prisma.collection.findFirst({
        where: { id: input.collectionId, userId: ctx.principal.userId },
        select: { id: true },
      })
      const profile = await prisma.taxpayerProfileRevision.findFirst({
        where: {
          id: input.taxpayerProfileRevisionId,
          userId: ctx.principal.userId,
        },
      })
      if (!collection || !profile)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Colección o perfil no encontrado.',
        })
      const blocks = collectionContextBlocks(
        input,
        TaxpayerProfileContextSchema.parse(profile),
      )
      if (
        input.purpose === 'vat_credit' &&
        profile.vatFilingFrequency !== 'none' &&
        profile.vatFilingFrequency !== 'unknown' &&
        !isCompatibleVatPeriod(
          input.period.startDate,
          input.period.endDate,
          profile.vatFilingFrequency as 'monthly' | 'semiannual',
        )
      )
        blocks.push({
          code: 'UNRESOLVED_ANALYSIS_CONFIGURATION',
          message:
            'El período no coincide con la periodicidad de IVA del perfil.',
          actionLabel: 'Ajustar período',
          actionPath: `/collections/${input.collectionId}`,
        })
      if (blocks.length)
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: blocks.map((block) => block.message).join(' '),
        })
      const activities = await prisma.economicActivityRevision.count({
        where: {
          id: { in: input.activityRevisionIds },
          userId: ctx.principal.userId,
        },
      })
      if (activities !== input.activityRevisionIds.length)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Selecciona solo actividades propias.',
        })
      return prisma.$transaction(async (tx) => {
        const latest = await tx.collectionContextRevision.findFirst({
          where: {
            collectionId: input.collectionId,
            userId: ctx.principal.userId,
          },
          orderBy: { revision: 'desc' },
        })
        const revision = await tx.collectionContextRevision.create({
          data: {
            collectionId: input.collectionId,
            userId: ctx.principal.userId,
            taxpayerProfileRevisionId: input.taxpayerProfileRevisionId,
            purpose: input.purpose,
            periodStartDate: new Date(
              `${input.period.startDate}T00:00:00.000Z`,
            ),
            periodEndDate: new Date(`${input.period.endDate}T00:00:00.000Z`),
            notes: input.notes,
            revision: (latest?.revision ?? 0) + 1,
          },
        })
        await tx.collectionContextActivityRevision.createMany({
          data: input.activityRevisionIds.map((economicActivityRevisionId) => ({
            userId: ctx.principal.userId,
            collectionContextRevisionId: revision.id,
            economicActivityRevisionId,
          })),
        })
        return revision
      })
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

      const context = await prisma.collectionContextRevision.findFirst({
        where: { collectionId: collection.id, userId: principal.userId },
        include: { taxpayerProfileRevision: true, activities: true },
        orderBy: { revision: 'desc' },
      })
      if (!context) {
        await persistBlockedRun({
          userId: principal.userId,
          collectionId: collection.id,
          code: 'MISSING_COLLECTION_CONTEXT',
          message:
            'Configura el propósito, período y perfil de la colección antes de analizar.',
        })
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            'Configura el propósito, período y perfil de la colección antes de analizar.',
        })
      }
      const contextBlocks = collectionContextBlocks(
        {
          purpose: context.purpose as
            | 'vat_credit'
            | 'business_income_tax'
            | 'personal_expenses',
          period: {
            startDate: context.periodStartDate.toISOString().slice(0, 10),
            endDate: context.periodEndDate.toISOString().slice(0, 10),
          },
          taxpayerProfileRevisionId: context.taxpayerProfileRevisionId,
          activityRevisionIds: context.activities.map(
            (activity) => activity.economicActivityRevisionId,
          ),
          notes: context.notes ?? undefined,
        },
        TaxpayerProfileContextSchema.parse(context.taxpayerProfileRevision),
      )
      if (contextBlocks.length) {
        const message = contextBlocks.map((block) => block.message).join(' ')
        await persistBlockedRun({
          userId: principal.userId,
          collectionId: collection.id,
          contextRevisionId: context.id,
          taxpayerProfileRevisionId: context.taxpayerProfileRevisionId,
          code: contextBlocks[0].code,
          message,
        })
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message,
        })
      }
      const ruleSet = await prisma.taxRuleSet.findFirst({
        where: {
          purpose: context.purpose,
          taxRegime: context.taxpayerProfileRevision.taxRegime,
          vatFilingFrequency:
            context.taxpayerProfileRevision.vatFilingFrequency,
          reviewStatus: 'active',
          effectiveFrom: { lte: context.periodStartDate },
          OR: [
            { effectiveTo: null },
            { effectiveTo: { gte: context.periodEndDate } },
          ],
        },
        orderBy: { effectiveFrom: 'desc' },
      })
      if (!ruleSet) {
        const message =
          'No existe un ruleset oficial activo para este contexto y período.'
        await persistBlockedRun({
          userId: principal.userId,
          collectionId: collection.id,
          contextRevisionId: context.id,
          taxpayerProfileRevisionId: context.taxpayerProfileRevisionId,
          code: 'MISSING_APPLICABLE_RULESET',
          message,
        })
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message })
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

      const analysisRun = await prisma.analysisRun.create({
        data: {
          userId: principal.userId,
          collectionId: collection.id,
          collectionContextRevisionId: context.id,
          taxpayerProfileRevisionId: context.taxpayerProfileRevisionId,
          ruleSetId: ruleSet.id,
          providerConnectionId: connection.id,
          provider: connection.provider,
          modelId: connection.modelId,
          promptVersion: 'v2',
          inputSnapshot: {
            schemaVersion: 'v2',
            collectionContextRevisionId: context.id,
            taxpayerProfileRevisionId: context.taxpayerProfileRevisionId,
            activityRevisionIds: context.activities.map(
              (activity) => activity.economicActivityRevisionId,
            ),
            ruleSetId: ruleSet.id,
            providerConnectionId: connection.id,
          },
          idempotencyKey: crypto.randomUUID(),
          status: 'queued',
          invoices: {
            create: billsToAnalyze.map((bill) => ({
              billId: bill.id,
              snapshot: { id: bill.id },
            })),
          },
        },
      })

      const payload: AnalyzeJobData = {
        jobId: crypto.randomUUID(),
        userId: principal.userId,
        credentialId: connection.id,
        analysisRunId: analysisRun.id,
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
      const connectionCount = await prisma.providerConnection.count({
        where: {
          userId: ctx.principal.userId,
          isActive: true,
          deletedAt: null,
        },
      })

      return {
        canAnalyze: canAnalyzeWithRequirements(connectionCount, 0),
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
