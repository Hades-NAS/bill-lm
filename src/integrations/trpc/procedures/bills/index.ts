import { TRPCError } from '@trpc/server'

import { WithAuthSchema } from '#/schema/auth'
import { DeleteBillsRequestSchema, UploadBillsRequestSchema } from '#/schema/collections'

import { getServiceLogger } from '#/integrations/logger.server'
import { StorageHelper } from '#/integrations/minio/helper'
import { prisma } from '#/integrations/prisma'
import { publicProcedure } from '#/integrations/trpc/init'

import type { TRPCRouter } from '#/integrations/trpc/router'
import type { inferRouterOutputs, TRPCRouterRecord } from '@trpc/server'

const logger = getServiceLogger('Bills')

const TypeMimes = {
  'application/pdf': 'PDF',
  'text/xml': 'XML',
} as const

export const billsRouter = {
  uploadBills: publicProcedure
    .input(WithAuthSchema(UploadBillsRequestSchema))
    .mutation(async ({ input }) => {
      const { auth, data } = input
      const { bills, collectionId } = data

      logger.info('Received request to upload bills', {
        collectionId,
        userId: auth.userId,
        billCount: bills.length,
      })

      const collection = await prisma.collection.findFirst({
        where: {
          id: collectionId,
          userId: auth.userId,
        },
      })

      if (!collection) {
        logger.warn('Collection not found for bill upload', {
          collectionId,
          userId: auth.userId,
        })

        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Collection not found',
        })
      }

      const billData = bills.map((bill) => {
        const ext = StorageHelper.getExtensionFromContentType(bill.mimeType)
        const uiName = crypto.randomUUID().slice(0, 8) + '.' + ext

        return {
          collectionId,
          name: bill.name,
          fileType: TypeMimes[bill.mimeType],
          storagePath: `collections/${collectionId}/bills/${uiName}`,
        }
      })

      logger.info('Uploading bills to storage', {
        collectionId,
        userId: auth.userId,
        billCount: bills.length,
      })

      await prisma.$transaction(async (tx) => {
        await Promise.all(
          bills.map((bill, index) => {
            const { storagePath } = billData[index]
            const buffer = Buffer.from(bill.base64, 'base64')

            return StorageHelper.putObject(
              storagePath,
              buffer,
              bill.mimeType,
            )
          }),
        )

        logger.info('Bills uploaded to storage, now saving metadata to database', {
          collectionId,
          userId: auth.userId,
          billCount: bills.length,
        })

        await tx.bill.createMany({
          data: billData,
        })

        logger.info('Bill metadata saved to database successfully', {
          collectionId,
          userId: auth.userId,
          billCount: bills.length,
        })
      })

      logger.info('Bills uploaded successfully', {
        collectionId,
        userId: auth.userId,
        billCount: bills.length,
      })

      return { collectionId }

    }),
  deleteBills: publicProcedure
    .input(WithAuthSchema(DeleteBillsRequestSchema))
    .mutation(async ({ input }) => {
      const { auth, data } = input
      const { collectionId, billIds } = data

      logger.info('Received request to delete bills', {
        collectionId,
        userId: auth.userId,
        billIds,
      })

      const collection = await prisma.collection.findUnique({
        where: {
          id: collectionId,
          userId: auth.userId,
        },
      })

      if (!collection) {
        logger.warn('Collection not found for bill deletion', {
          collectionId,
          userId: auth.userId,
        })

        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Collection not found',
        })
      }

      const bills = await prisma.bill.findMany({
        where: {
          id: { in: billIds },
          collectionId,
        },
      })

      await prisma.$transaction(async (tx) => {
        await Promise.all(
          bills.map((bill) =>
            StorageHelper.deleteObject(bill.storagePath),
          ),
        )

        logger.info('Bills deleted from storage, now deleting metadata from database', {
          collectionId,
          userId: auth.userId,
          billIds,
        })

        await tx.bill.deleteMany({
          where: {
            id: { in: billIds },
            collectionId,
          },
        })

        logger.info('Bill metadata deleted from database successfully', {
          collectionId,
          userId: auth.userId,
          billIds,
        })
      })

      logger.info('Bills deleted successfully', {
        collectionId,
        userId: auth.userId,
        billIds,
      })

      return { collectionId }
    }),
} satisfies TRPCRouterRecord

export type TRPCRouterOutputs = inferRouterOutputs<TRPCRouter>

export type CollectionBaseType =
  TRPCRouterOutputs['collections']['list'][number]
