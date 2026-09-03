import { TRPCError } from '@trpc/server'

import {
  FiscalReferenceIdSchema,
  FISCAL_REFERENCE_MAX_BYTES,
  UploadFiscalReferenceSchema,
} from '#/schema/fiscal-references'

import { getServiceLogger } from '#/integrations/logger.server'
import { StorageHelper } from '#/integrations/minio/helper'
import { prisma } from '#/integrations/prisma'
import {
  fiscalReferenceContentHash,
  FiscalReferenceInputError,
  assertFiscalReferenceLimit,
  assertFiscalReferenceSource,
  normalizeFiscalReferenceMarkdown,
  pdfBufferToNormalizedMarkdown,
  withStorageCleanupOnFailure,
} from '#/integrations/fiscal-references/normalizer.server'

import { privateProcedure } from '../../init'

import type { TRPCRouterRecord } from '@trpc/server'

const logger = getServiceLogger('FiscalReferences')

const publicSelect = {
  id: true,
  name: true,
  sourceType: true,
  normalizedSize: true,
  createdAt: true,
} as const

function decodeFile(base64: string): Buffer {
  const buffer = Buffer.from(base64, 'base64')
  if (buffer.length === 0 || buffer.length > FISCAL_REFERENCE_MAX_BYTES)
    throw new TRPCError({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Cada referencia puede pesar como máximo 5 MB.',
    })
  return buffer
}

export const fiscalReferencesRouter = {
  list: privateProcedure.query(async ({ ctx }) =>
    prisma.fiscalReference.findMany({
      where: { userId: ctx.principal.userId, deletedAt: null },
      select: publicSelect,
      orderBy: { createdAt: 'desc' },
    }),
  ),
  upload: privateProcedure
    .input(UploadFiscalReferenceSchema)
    .mutation(async ({ input, ctx }) => {
      const buffer = decodeFile(input.file.base64)
      let normalizedMarkdown: string
      try {
        assertFiscalReferenceSource(buffer, input.file.mimeType)
        normalizedMarkdown =
          input.file.mimeType === 'application/pdf'
            ? await pdfBufferToNormalizedMarkdown(buffer)
            : normalizeFiscalReferenceMarkdown(buffer.toString('utf8'))
      } catch (error) {
        if (error instanceof FiscalReferenceInputError)
          throw new TRPCError({ code: 'BAD_REQUEST', message: error.message })
        throw error
      }

      const id = crypto.randomUUID()
      const storagePath = `users/${ctx.principal.userId}/fiscal-references/${id}/normalized.md`
      await StorageHelper.putObject(
        storagePath,
        Buffer.from(normalizedMarkdown, 'utf8'),
        'text/markdown; charset=utf-8',
      )

      return withStorageCleanupOnFailure(
        () =>
          prisma.$transaction(async (tx) => {
          // Serializa altas del mismo usuario para que el límite de tres no se
          // pueda sobrepasar con dos solicitudes concurrentes.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ctx.principal.userId}))`
          const count = await tx.fiscalReference.count({
            where: { userId: ctx.principal.userId, deletedAt: null },
          })
          try {
            assertFiscalReferenceLimit(count)
          } catch (error) {
            if (error instanceof FiscalReferenceInputError)
              throw new TRPCError({
                code: 'PRECONDITION_FAILED',
                message: error.message,
              })
            throw error
          }

          return tx.fiscalReference.create({
            data: {
              id,
              userId: ctx.principal.userId,
              name: input.file.name,
              sourceType:
                input.file.mimeType === 'application/pdf' ? 'PDF' : 'MARKDOWN',
              storagePath,
              contentHash: fiscalReferenceContentHash(normalizedMarkdown),
              normalizedSize: Buffer.byteLength(normalizedMarkdown, 'utf8'),
            },
            select: publicSelect,
          })
          }),
        () => StorageHelper.deleteObject(storagePath),
      )
    }),
  remove: privateProcedure
    .input(FiscalReferenceIdSchema)
    .mutation(async ({ input, ctx }) => {
      const reference = await prisma.fiscalReference.findFirst({
        where: { id: input.id, userId: ctx.principal.userId, deletedAt: null },
        select: { id: true, storagePath: true },
      })
      if (!reference)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Referencia fiscal no encontrada.',
        })

      await prisma.fiscalReference.update({
        where: { id: reference.id },
        data: { deletedAt: new Date() },
      })
      try {
        await StorageHelper.deleteObject(reference.storagePath)
      } catch (error) {
        logger.warn('Could not remove normalized fiscal reference from storage', {
          referenceId: reference.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }),
} satisfies TRPCRouterRecord
