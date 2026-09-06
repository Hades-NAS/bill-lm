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
  AnalysisExecutionEnvelopeSchema,
  GetAnalysisRunDetailRequestSchema,
  ListAnalysisRunHistoryRequestSchema,
} from '#/schema/tax-analysis'

import { adminDb } from '#/integrations/firebase/firebase.server'
import { env } from '#/env'
import { canAnalyzeWithRequirements } from '#/integrations/fiscal-references/normalizer.server'
import { normalizeFiscalReferenceMarkdown } from '#/integrations/fiscal-references/normalizer.server'
import { getServiceLogger } from '#/integrations/logger.server'
import {
  AnalysisPrerequisiteError,
  assertAnalysisEnvelopeCanExecute,
} from '#/integrations/tax-analysis/analysis-gate'
import {
  selectApplicableOfficialEvidence,
  sha256,
} from '#/integrations/tax-analysis/execution-envelope.server'
import {
  projectAnalysisRunDetail,
  projectAnalysisRunHistoryItem,
} from '#/integrations/tax-analysis/history-projection.server'
import { BILL_ANALYSIS_PROMPT_METADATA } from '#/integrations/prompts/bill-prompt-builder'
import { StorageHelper } from '#/integrations/minio/helper'
import { prisma } from '#/integrations/prisma'
import { AnalyzeQueue } from '#/integrations/queue/analyze-queue'
import { selectApplicableTaxRuleSet } from '#/integrations/tax-rules/selector'

import { FireCollections } from '#/constants/firebase'

import { transformRawToParsed } from '#/schema/bill-analysis'
import { parseAndValidateInvoiceXML } from '#/integrations/xml'

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
          deletedAt: null,
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

      const existingCollection = await prisma.collection.findFirst({
        where: { id: data.id, userId: principal.userId, deletedAt: null },
        select: { id: true },
      })
      if (!existingCollection)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'La colección no existe o fue archivada.',
        })
      const collection = await prisma.collection.update({
        where: { id: existingCollection.id, userId: principal.userId },
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

      const result = await prisma.collection.updateMany({
        where: {
          id: input.id,
          userId: principal.userId,
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      })

      if (result.count === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'La colección no existe o ya fue eliminada.',
        })
      }

      logger.info('Archived collection for user', {
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

      const collection = await prisma.collection.findFirst({
        where: { id: data.id, userId: principal.userId, deletedAt: null },
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
          message: 'Colección no encontrada.',
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
        where: { id: input.id, userId: ctx.principal.userId, deletedAt: null },
        select: { id: true },
      })
      if (!collection)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Colección no encontrada.',
        })
      return prisma.collectionContextRevision.findMany({
        where: { collectionId: collection.id, userId: ctx.principal.userId },
        include: {
          activities: {
            include: { economicActivityRevision: true },
          },
          taxpayerProfileRevision: true,
        },
        orderBy: { revision: 'desc' },
      })
    }),
  listAnalysisRuns: privateProcedure
    .input(GetCollectionByIdRequestSchema)
    .query(async ({ input, ctx }) => {
      const collection = await prisma.collection.findFirst({
        where: { id: input.id, userId: ctx.principal.userId, deletedAt: null },
        select: { id: true },
      })
      if (!collection)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Colección no encontrada.',
        })
      const runs = await prisma.analysisRun.findMany({
        where: { collectionId: collection.id, userId: ctx.principal.userId },
        select: {
          id: true,
          status: true,
          blockCode: true,
          blockMessage: true,
          provider: true,
          modelId: true,
          promptVersion: true,
          inputSnapshot: true,
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
            orderBy: [{ createdAt: 'asc' }, { billId: 'asc' }],
          },
          _count: { select: { invoices: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
      return runs.map(projectAnalysisRunHistoryItem)
    }),
  listAnalysisRunHistory: privateProcedure
    .input(ListAnalysisRunHistoryRequestSchema)
    .query(async ({ input, ctx }) => {
      const collection = await prisma.collection.findFirst({
        where: {
          id: input.collectionId,
          userId: ctx.principal.userId,
          deletedAt: null,
        },
        select: { id: true },
      })
      if (!collection)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Colección no encontrada.',
        })

      const runs = await prisma.analysisRun.findMany({
        where: {
          collectionId: collection.id,
          userId: ctx.principal.userId,
          ...(input.cursor
            ? {
                OR: [
                  { createdAt: { lt: input.cursor.createdAt } },
                  {
                    createdAt: input.cursor.createdAt,
                    id: { lt: input.cursor.id },
                  },
                ],
              }
            : {}),
        },
        take: input.limit + 1,
        select: {
          id: true,
          status: true,
          blockCode: true,
          blockMessage: true,
          provider: true,
          modelId: true,
          promptVersion: true,
          inputSnapshot: true,
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
            orderBy: [{ createdAt: 'asc' }, { billId: 'asc' }],
          },
          _count: { select: { invoices: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
      const page = runs.slice(0, input.limit)
      const last = page.at(-1)
      return {
        items: page.map(projectAnalysisRunHistoryItem),
        nextCursor:
          runs.length > input.limit && last
            ? { createdAt: last.createdAt, id: last.id }
            : null,
      }
    }),
  getAnalysisRunDetail: privateProcedure
    .input(GetAnalysisRunDetailRequestSchema)
    .query(async ({ input, ctx }) => {
      const collection = await prisma.collection.findFirst({
        where: {
          id: input.collectionId,
          userId: ctx.principal.userId,
          deletedAt: null,
        },
        select: { id: true },
      })
      if (!collection)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Colección no encontrada.',
        })

      const run = await prisma.analysisRun.findFirst({
        where: {
          id: input.runId,
          collectionId: collection.id,
          userId: ctx.principal.userId,
        },
        select: {
          id: true,
          status: true,
          blockCode: true,
          blockMessage: true,
          provider: true,
          modelId: true,
          promptVersion: true,
          inputSnapshot: true,
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
            orderBy: [{ createdAt: 'asc' }, { billId: 'asc' }],
          },
          _count: { select: { invoices: true } },
        },
      })
      if (!run)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Análisis no encontrado.',
        })
      return projectAnalysisRunDetail(run)
    }),
  createContextRevision: privateProcedure
    .input(CollectionContextInputSchema)
    .mutation(async ({ input, ctx }) => {
      const collection = await prisma.collection.findFirst({
        where: {
          id: input.collectionId,
          userId: ctx.principal.userId,
          deletedAt: null,
        },
        select: { id: true },
      })
      const profile = await prisma.taxpayerProfileRevision.findFirst({
        where: {
          id: input.taxpayerProfileRevisionId,
          userId: ctx.principal.userId,
        },
        include: {
          activities: {
            select: { economicActivityRevisionId: true },
          },
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
      const profileActivityIds = new Set(
        profile.activities.map(
          (activity) => activity.economicActivityRevisionId,
        ),
      )
      if (
        input.activityRevisionIds.some(
          (activityId) => !profileActivityIds.has(activityId),
        )
      )
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Selecciona solo actividades incluidas en el perfil tributario.',
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

      const { type, billIds } = data

      const collection = await prisma.collection.findFirst({
        where: {
          id: data.collectionId,
          userId: principal.userId,
          deletedAt: null,
        },
      })

      if (!collection) {
        logger.warn('Collection not found for analysis', {
          userId: principal.userId,
          collectionId: data.collectionId,
        })

        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Colección no encontrada.',
        })
      }

      let connection
      try {
        connection = await resolveConnection(
          principal.userId,
          data.credentialId,
        )
      } catch (error) {
        if (error instanceof TRPCError && error.code === 'PRECONDITION_FAILED')
          await persistBlockedRun({
            userId: principal.userId,
            collectionId: collection.id,
            code: 'MISSING_PROVIDER_CONNECTION',
            message: error.message,
          })
        throw error
      }

      const context = await prisma.collectionContextRevision.findFirst({
        where: { collectionId: collection.id, userId: principal.userId },
        include: {
          taxpayerProfileRevision: true,
          activities: { include: { economicActivityRevision: true } },
        },
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
      const ruleSetCandidates = await prisma.taxRuleSet.findMany({
        where: {
          purpose: context.purpose,
          taxRegime: context.taxpayerProfileRevision.taxRegime,
          vatFilingFrequency:
            context.taxpayerProfileRevision.vatFilingFrequency,
          reviewStatus: 'active',
        },
        include: {
          fragments: {
            include: { fragment: { include: { source: true } } },
          },
        },
      })
      const selectedRuleSet = selectApplicableTaxRuleSet(
        {
          purpose: context.purpose as
            | 'vat_credit'
            | 'business_income_tax'
            | 'personal_expenses',
          period: {
            startDate: context.periodStartDate.toISOString().slice(0, 10),
            endDate: context.periodEndDate.toISOString().slice(0, 10),
          },
          taxRegime: context.taxpayerProfileRevision.taxRegime as
            | 'general'
            | 'rimpe_entrepreneur'
            | 'rimpe_popular_business'
            | 'unknown',
          vatFilingFrequency: context.taxpayerProfileRevision
            .vatFilingFrequency as
            | 'none'
            | 'monthly'
            | 'semiannual'
            | 'unknown',
        },
        ruleSetCandidates.map((candidate) => ({
          id: candidate.id,
          version: candidate.version,
          purpose: candidate.purpose as
            | 'vat_credit'
            | 'business_income_tax'
            | 'personal_expenses',
          taxRegime: candidate.taxRegime as
            | 'general'
            | 'rimpe_entrepreneur'
            | 'rimpe_popular_business'
            | 'unknown',
          vatFilingFrequency: candidate.vatFilingFrequency as
            | 'none'
            | 'monthly'
            | 'semiannual'
            | 'unknown',
          effectiveFrom: candidate.effectiveFrom.toISOString().slice(0, 10),
          effectiveTo:
            candidate.effectiveTo?.toISOString().slice(0, 10) ?? null,
          reviewStatus: candidate.reviewStatus as
            | 'draft'
            | 'reviewed'
            | 'active'
            | 'retired',
        })),
      )
      const ruleSet = selectedRuleSet
        ? ruleSetCandidates.find(
            (candidate) => candidate.id === selectedRuleSet.id,
          )
        : null
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

      let billsToAnalyze: Array<{
        id: string
        storagePath: string
        number: string
        billType: 'PERSONAL' | 'PROFESSIONAL' | 'OTHER'
        totalAmount: number
      }> = []
      const billSelect = {
        id: true,
        storagePath: true,
        number: true,
        billType: true,
        totalAmount: true,
      } as const

      if (type === 'all') {
        const bills = await prisma.billHeader.findMany({
          where: {
            collectionId: data.collectionId,
          },
          select: billSelect,
        })
        billsToAnalyze = bills
      } else if (type === 'missing') {
        const bills = await prisma.billHeader.findMany({
          where: {
            collectionId: data.collectionId,
          },
          select: billSelect,
        })
        billsToAnalyze = bills
      } else if (type === 'analyzed') {
        billsToAnalyze = []
      } else {
        const bills = await prisma.billHeader.findMany({
          where: {
            collectionId: data.collectionId,
            id: {
              in: billIds,
            },
          },
          select: billSelect,
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

      const officialEvidence = selectApplicableOfficialEvidence(
        {
          purpose: context.purpose as
            | 'vat_credit'
            | 'business_income_tax'
            | 'personal_expenses',
          period: {
            startDate: context.periodStartDate.toISOString().slice(0, 10),
            endDate: context.periodEndDate.toISOString().slice(0, 10),
          },
          taxRegime: context.taxpayerProfileRevision.taxRegime as
            | 'general'
            | 'rimpe_entrepreneur'
            | 'rimpe_popular_business'
            | 'unknown',
          vatFilingFrequency: context.taxpayerProfileRevision
            .vatFilingFrequency as
            | 'none'
            | 'monthly'
            | 'semiannual'
            | 'unknown',
        },
        ruleSet.fragments.map(({ id, fragment }) => ({
          ruleSetFragmentId: id,
          fragmentId: fragment.id,
          fragmentContentHash: fragment.contentHash,
          source: {
            id: fragment.source.id,
            title: fragment.source.title,
            issuer: fragment.source.issuer,
            officialUrl: fragment.source.officialUrl,
            contentHash: fragment.source.contentHash,
          },
          articleOrSection: fragment.articleOrSection,
          purposes: fragment.purposes as Array<
            'vat_credit' | 'business_income_tax' | 'personal_expenses'
          >,
          taxRegimes: fragment.taxRegimes as Array<
            | 'general'
            | 'rimpe_entrepreneur'
            | 'rimpe_popular_business'
            | 'unknown'
          >,
          effectiveFrom: fragment.effectiveFrom.toISOString().slice(0, 10),
          effectiveTo: fragment.effectiveTo?.toISOString().slice(0, 10) ?? null,
          markdown: fragment.contentMarkdown,
        })),
      )
      if (officialEvidence.length === 0) {
        const message =
          'El ruleset activo no contiene evidencia oficial aplicable para este contexto.'
        await persistBlockedRun({
          userId: principal.userId,
          collectionId: collection.id,
          contextRevisionId: context.id,
          taxpayerProfileRevisionId: context.taxpayerProfileRevisionId,
          code: 'NO_APPLICABLE_OFFICIAL_EVIDENCE',
          message,
        })
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message })
      }

      const references = await prisma.fiscalReference.findMany({
        where: { userId: principal.userId, deletedAt: null },
        select: { id: true, name: true, storagePath: true, contentHash: true },
        orderBy: { createdAt: 'asc' },
      })
      let invoiceSnapshots: Array<{
        billId: string
        contentHash: string
        parserVersion: 'xml-v1'
        normalized: ReturnType<typeof transformRawToParsed>
      }>
      try {
        invoiceSnapshots = await Promise.all(
          billsToAnalyze.map(async (bill) => {
            const xml = await StorageHelper.getObject(bill.storagePath)
            const parsed = parseAndValidateInvoiceXML(xml)
            if (!parsed.success)
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `No se pudo leer la factura ${bill.number}; vuelve a cargar un XML válido.`,
              })
            return {
              billId: bill.id,
              contentHash: sha256(xml),
              parserVersion: 'xml-v1' as const,
              normalized: transformRawToParsed(parsed.data),
            }
          }),
        )
      } catch (error) {
        const message =
          error instanceof TRPCError
            ? error.message
            : 'No se pudo preparar una factura para el análisis. Vuelve a cargar un XML válido.'
        await persistBlockedRun({
          userId: principal.userId,
          collectionId: collection.id,
          contextRevisionId: context.id,
          taxpayerProfileRevisionId: context.taxpayerProfileRevisionId,
          code: 'UNRESOLVED_ANALYSIS_CONFIGURATION',
          message,
        })
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message,
          cause: error,
        })
      }
      const userReferences = await Promise.all(
        references.map(async (reference) => ({
          id: reference.id,
          name: reference.name,
          normalizedMarkdown: normalizeFiscalReferenceMarkdown(
            (await StorageHelper.getObject(reference.storagePath)).toString(
              'utf8',
            ),
          ),
          contentHash: reference.contentHash,
        })),
      )
      const envelope = AnalysisExecutionEnvelopeSchema.parse({
        schemaVersion: 'v2',
        envelopeVersion: '1',
        execution: { mode: env.LLM_SMOKE_TEST ? 'smoke' : 'real' },
        prompt: BILL_ANALYSIS_PROMPT_METADATA,
        context: {
          collectionContextRevisionId: context.id,
          revision: context.revision,
          purpose: context.purpose,
          period: {
            startDate: context.periodStartDate.toISOString().slice(0, 10),
            endDate: context.periodEndDate.toISOString().slice(0, 10),
          },
          notes: context.notes,
        },
        taxpayerProfile: {
          revisionId: context.taxpayerProfileRevision.id,
          revision: context.taxpayerProfileRevision.revision,
          hasRuc: context.taxpayerProfileRevision.hasRuc,
          hasEmploymentIncome:
            context.taxpayerProfileRevision.hasEmploymentIncome,
          taxRegime: context.taxpayerProfileRevision.taxRegime,
          vatFilingFrequency:
            context.taxpayerProfileRevision.vatFilingFrequency,
          additionalFacts: context.taxpayerProfileRevision.additionalFacts,
        },
        activities: context.activities.map(
          ({ economicActivityRevision: activity }) => ({
            revisionId: activity.id,
            revision: activity.revision,
            displayName: activity.displayName,
            registeredActivityCode: activity.registeredActivityCode,
            registeredActivityName: activity.registeredActivityName,
            activityDescription: activity.activityDescription,
            necessaryPurchases: activity.necessaryPurchases,
            revenueVatTreatment: activity.revenueVatTreatment,
            additionalFacts: activity.additionalFacts,
          }),
        ),
        provider: {
          id: connection.id,
          provider: connection.provider,
          modelId: connection.modelId,
        },
        ruleset: {
          id: ruleSet.id,
          version: ruleSet.version,
          contentHash: ruleSet.contentHash,
          effectiveFrom: ruleSet.effectiveFrom.toISOString().slice(0, 10),
          effectiveTo: ruleSet.effectiveTo?.toISOString().slice(0, 10) ?? null,
        },
        officialEvidence,
        userReferences,
        invoices: invoiceSnapshots,
      })
      try {
        assertAnalysisEnvelopeCanExecute(envelope)
      } catch (error) {
        if (!(error instanceof AnalysisPrerequisiteError)) throw error
        await persistBlockedRun({
          userId: principal.userId,
          collectionId: collection.id,
          contextRevisionId: context.id,
          taxpayerProfileRevisionId: context.taxpayerProfileRevisionId,
          code: error.code,
          message: error.message,
        })
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: error.message,
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
          inputSnapshot: JSON.parse(JSON.stringify(envelope)),
          idempotencyKey: crypto.randomUUID(),
          status: 'queued',
          invoices: {
            create: invoiceSnapshots.map((bill) => ({
              billId: bill.billId,
              contentHash: bill.contentHash,
              snapshot: JSON.parse(JSON.stringify(bill)),
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

      try {
        await adminDb
          .collection(FireCollections.ANALYZE_COLLECTION)
          .doc(payload.jobId)
          .set(notification)

        await AnalyzeQueue.add(jobName, payload)
      } catch (error) {
        await prisma.analysisRun.update({
          where: { id: analysisRun.id },
          data: { status: 'failed', completedAt: new Date() },
        })
        logger.error('Could not queue analysis run', {
          userId: principal.userId,
          collectionId: collection.id,
          runId: analysisRun.id,
        })
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            'No se pudo enviar el análisis a la cola. Inténtalo nuevamente.',
          cause: error,
        })
      }

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
