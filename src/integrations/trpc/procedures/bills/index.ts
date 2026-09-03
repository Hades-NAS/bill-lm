import { TRPCError } from '@trpc/server'

import {
  DeleteBillsRequestSchema,
  GetBillDetailRequestSchema,
  UploadBillsRequestSchema,
} from '#/schema/collections'

import { getServiceLogger } from '#/integrations/logger.server'
import { StorageHelper } from '#/integrations/minio/helper'
import { prisma } from '#/integrations/prisma'
import { privateProcedure } from '#/integrations/trpc/init'
import { parseAndValidateInvoiceXML } from '#/integrations/xml'

import { getBillAmounts, getBillType } from '#/utils/bill'
import { roundToDecimals } from '#/utils/math'

import type {
  BillDetailCreateManyInput,
  BillHeaderCreateManyInput,
} from '#/generated/prisma/models'
import type { TRPCRouter } from '#/integrations/trpc/router'
import type { inferRouterOutputs, TRPCRouterRecord } from '@trpc/server'

const logger = getServiceLogger('Bills')

const TypeMimes = {
  'application/pdf': 'PDF',
  'text/xml': 'XML',
} as const

export const billsRouter = {
  uploadBills: privateProcedure
    .input(UploadBillsRequestSchema)
    .mutation(async ({ input: data, ctx }) => {
      const { principal } = ctx
      const { bills, collectionId } = data

      logger.info('Received request to upload bills', {
        collectionId,
        userId: principal.userId,
        billCount: bills.length,
      })

      const collection = await prisma.collection.findFirst({
        where: {
          id: collectionId,
          userId: principal.userId,
        },
      })

      if (!collection) {
        logger.warn('Collection not found for bill upload', {
          collectionId,
          userId: principal.userId,
        })

        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Collection not found',
        })
      }

      const billData = bills.map((bill) => {
        const ext = StorageHelper.getExtensionFromContentType(bill.mimeType)
        const uiName = crypto.randomUUID().slice(0, 8) + '.' + ext

        const billParsed = parseAndValidateInvoiceXML(
          Buffer.from(bill.base64, 'base64'),
        )

        logger.info('Parsed invoice XML for bill upload', {
          billParsed,
        })

        if (!billParsed.success) {
          logger.warn(
            'Failed to parse and validate invoice XML for bill upload',
            {
              collectionId,
              userId: principal.userId,
              error: billParsed.error,
            },
          )

          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Failed to parse and validate invoice XML: ${billParsed.error}`,
          })
        }

        const { infoFactura, infoTributaria } = billParsed.data.factura

        const billAmounts = getBillAmounts(infoFactura)
        const billTargetType = getBillType(infoFactura.identificacionComprador)

        const billId = crypto.randomUUID()

        const header: BillHeaderCreateManyInput = {
          ...billAmounts,
          id: billId,
          number: infoTributaria.secuencial,
          billType: billTargetType,
          collectionId,
          buyerName: infoFactura.razonSocialComprador,
          idBuyer: infoFactura.identificacionComprador,
          comercialName: infoTributaria.nombreComercial,
          socialName: infoTributaria.razonSocial,
          idSeller: infoTributaria.ruc,
          addressMatriz: infoTributaria.dirMatriz,
          name: bill.name,
          fileType: TypeMimes[bill.mimeType],
          storagePath: `collections/${collectionId}/bills/${uiName}`,
        }

        const billDetails: Array<BillDetailCreateManyInput> =
          billParsed.data.factura.detalles.detalle.map((detalle) => ({
            description: detalle.descripcion,
            billId,
            quantity: roundToDecimals(detalle.cantidad, 0),
            unitPrice: roundToDecimals(detalle.precioUnitario),
            discount: roundToDecimals(detalle.descuento),
          }))

        return {
          header,
          details: billDetails,
        }
      })

      logger.info('Uploading bills to storage', {
        collectionId,
        userId: principal.userId,
        billCount: bills.length,
      })

      await prisma.$transaction(async (tx) => {
        await Promise.all(
          bills.map((bill, index) => {
            const { storagePath } = billData[index].header
            const buffer = Buffer.from(bill.base64, 'base64')

            return StorageHelper.putObject(storagePath, buffer, bill.mimeType)
          }),
        )

        logger.info(
          'Bills uploaded to storage, now saving metadata to database',
          {
            collectionId,
            userId: principal.userId,
            billCount: bills.length,
          },
        )

        await tx.billHeader.createMany({
          data: billData.map((bill) => bill.header),
          skipDuplicates: true,
        })

        await tx.billDetail.createMany({
          data: billData.flatMap((bill) => bill.details),
          skipDuplicates: true,
        })

        logger.info('Bill metadata saved to database successfully', {
          collectionId,
          userId: principal.userId,
          billCount: bills.length,
        })
      })

      logger.info('Bills uploaded successfully', {
        collectionId,
        userId: principal.userId,
        billCount: bills.length,
      })

      return { collectionId }
    }),
  deleteBills: privateProcedure
    .input(DeleteBillsRequestSchema)
    .mutation(async ({ input: data, ctx }) => {
      const { principal } = ctx
      const { collectionId, billIds } = data

      logger.info('Received request to delete bills', {
        collectionId,
        userId: principal.userId,
        billIds,
      })

      const collection = await prisma.collection.findUnique({
        where: {
          id: collectionId,
          userId: principal.userId,
        },
      })

      if (!collection) {
        logger.warn('Collection not found for bill deletion', {
          collectionId,
          userId: principal.userId,
        })

        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Collection not found',
        })
      }

      const bills = await prisma.billHeader.findMany({
        where: {
          id: { in: billIds },
          collectionId,
        },
      })

      await prisma.$transaction(async (tx) => {
        await Promise.all(
          bills.map((bill) => StorageHelper.deleteObject(bill.storagePath)),
        )

        logger.info(
          'Bills deleted from storage, now deleting metadata from database',
          {
            collectionId,
            userId: principal.userId,
            billIds,
          },
        )

        await tx.billHeader.deleteMany({
          where: {
            id: { in: billIds },
            collectionId,
          },
        })

        logger.info('Bill metadata deleted from database successfully', {
          collectionId,
          userId: principal.userId,
          billIds,
        })
      })

      logger.info('Bills deleted successfully', {
        collectionId,
        userId: principal.userId,
        billIds,
      })

      return { collectionId }
    }),
  getBillDetailById: privateProcedure
    .input(GetBillDetailRequestSchema)
    .query(async ({ input: data, ctx }) => {
      const { principal } = ctx

      const { billId } = data

      logger.info('Received request to get bill details', {
        billId,
        userId: principal.userId,
      })

      const bill = await prisma.billHeader.findFirst({
        where: {
          id: billId,
          collection: {
            userId: principal.userId,
          },
        },
        include: {
          details: {
            orderBy: [{ unitPrice: 'desc' }, { quantity: 'desc' }],
          },
        },
      })

      if (!bill) {
        logger.warn('Bill not found for get details request', {
          billId,
          userId: principal.userId,
        })

        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Bill not found',
        })
      }

      logger.info('Bill details retrieved successfully', {
        billId,
        userId: principal.userId,
      })

      return bill
    }),
} satisfies TRPCRouterRecord

export type TRPCRouterOutputs = inferRouterOutputs<TRPCRouter>

export type CollectionBaseType =
  TRPCRouterOutputs['collections']['list'][number]
