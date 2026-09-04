import { TRPCError } from '@trpc/server'
import z from 'zod'

import { adminAuth, adminDb } from '#/integrations/firebase/firebase.server'
import { StorageHelper } from '#/integrations/minio/helper'
import { prisma } from '#/integrations/prisma'

import { FireCollections } from '#/constants/firebase'

import { privateProcedure } from '../../init'

async function deleteFirestoreUserData(userId: string) {
  const collections = [
    FireCollections.ANALYZE_COLLECTION,
    FireCollections.TELEMETRY_COLLECTION,
  ]
  for (const collection of collections) {
    const snapshot = await adminDb
      .collection(collection)
      .where('userId', '==', userId)
      .get()
    await Promise.all(snapshot.docs.map((document) => document.ref.delete()))
  }
}

async function deleteStoredUserData(userId: string) {
  const [references, bills] = await Promise.all([
    prisma.fiscalReference.findMany({
      where: { userId },
      select: { storagePath: true },
    }),
    prisma.billHeader.findMany({
      where: { collection: { userId } },
      select: { storagePath: true },
    }),
  ])
  const paths = [...references, ...bills].map((item) => item.storagePath)
  await Promise.all(paths.map((path) => StorageHelper.deleteObject(path)))
}

export const accountRouter = {
  remove: privateProcedure
    .input(z.object({ confirmation: z.literal('ELIMINAR') }))
    .mutation(async ({ ctx }) => {
      const userId = ctx.principal.userId
      try {
        await deleteStoredUserData(userId)
        await prisma.$transaction(async (tx) => {
          await tx.analysisRun.deleteMany({ where: { userId } })
          await tx.collectionContextActivityRevision.deleteMany({
            where: { userId },
          })
          await tx.collectionContextRevision.deleteMany({ where: { userId } })
          await tx.taxpayerProfileActivityRevision.deleteMany({
            where: { userId },
          })
          await tx.taxpayerProfileRevision.deleteMany({ where: { userId } })
          await tx.economicActivityRevision.deleteMany({ where: { userId } })
          await tx.collection.deleteMany({ where: { userId } })
          await tx.providerConnection.deleteMany({ where: { userId } })
          await tx.fiscalReference.deleteMany({ where: { userId } })
          await tx.authIdentity.deleteMany({ where: { userId } })
          await tx.economicActivity.deleteMany({ where: { userId } })
          await tx.taxpayerProfile.deleteMany({ where: { userId } })
          await tx.user.delete({ where: { id: userId } })
        })
        await deleteFirestoreUserData(userId)
        await adminAuth.deleteUser(ctx.principal.subject)
      } catch {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            'No se pudo eliminar la cuenta por completo. Intenta de nuevo o contacta soporte.',
        })
      }
      return { removed: true }
    }),
}
