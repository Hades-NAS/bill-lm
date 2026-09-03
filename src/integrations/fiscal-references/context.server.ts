import { StorageHelper } from '#/integrations/minio/helper'
import { prisma } from '#/integrations/prisma'

import { FiscalReferenceInputError, normalizeFiscalReferenceMarkdown } from './normalizer.server'

export async function loadActiveFiscalReferenceContext(userId: string) {
  const references = await prisma.fiscalReference.findMany({
    where: { userId, deletedAt: null },
    select: { id: true, name: true, storagePath: true },
    orderBy: { createdAt: 'asc' },
  })

  if (references.length === 0)
    throw new FiscalReferenceInputError(
      'Agrega al menos una referencia fiscal autogestionada antes de analizar.',
    )

  return await Promise.all(
    references.map(async (reference) => ({
      id: reference.id,
      name: reference.name,
      markdown: normalizeFiscalReferenceMarkdown(
        (await StorageHelper.getObject(reference.storagePath)).toString('utf8'),
      ),
    })),
  )
}
