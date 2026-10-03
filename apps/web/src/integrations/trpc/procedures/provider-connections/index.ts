import { TRPCError } from '@trpc/server'

import {
  ConnectionIdInputSchema,
  CreateProviderConnectionSchema,
  RotateProviderConnectionSchema,
  UpdateProviderConnectionSchema,
} from '#/schema/provider-connections'

import {
  decryptProviderSecret,
  encryptProviderSecret,
} from '#/integrations/llm/byok-crypto.server'
import { LLMProviderFactory } from '#/integrations/llm/llm-provider-factory'
import { prisma } from '#/integrations/prisma'

import { privateProcedure } from '../../init'

import type { TRPCRouterRecord } from '@trpc/server'

import { ProviderConnectionProvider } from '#/generated/prisma/client'

const publicSelect = {
  id: true,
  provider: true,
  label: true,
  modelId: true,
  isActive: true,
  isDefault: true,
  secretLastFour: true,
  probedAt: true,
  lastProbeError: true,
  createdAt: true,
  updatedAt: true,
} as const
const toPublic = <T extends { provider: ProviderConnectionProvider }>(
  connection: T,
) => connection
const providerDb = (provider: 'openai' | 'claude') =>
  provider === 'openai'
    ? ProviderConnectionProvider.OPENAI
    : ProviderConnectionProvider.CLAUDE

async function ownedConnection(userId: string, id: string) {
  const connection = await prisma.providerConnection.findFirst({
    where: { id, userId, deletedAt: null },
  })
  if (!connection)
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Conexión no encontrada',
    })
  return connection
}

async function persistProbeResult(connection: Awaited<ReturnType<typeof ownedConnection>>, success: boolean) {
  const updated = await prisma.providerConnection.updateMany({
    where: {
      id: connection.id,
      userId: connection.userId,
      provider: connection.provider,
      modelId: connection.modelId,
      secretVersion: connection.secretVersion,
      isActive: connection.isActive,
      deletedAt: null,
    },
    data: {
      probedAt: new Date(),
      lastProbeError: success ? null : 'No se pudo validar la conexión.',
    },
  })
  const current = await prisma.providerConnection.findFirst({
    where: { id: connection.id, userId: connection.userId, deletedAt: null },
    select: publicSelect,
  })
  if (!current)
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Conexión no encontrada' })
  // A zero count is an optimistic-concurrency miss; return the current safe row,
  // never the stale probe outcome.
  if (updated.count === 0) return toPublic(current)
  return toPublic(current)
}

export const providerConnectionsRouter = {
  list: privateProcedure.query(async ({ ctx }) =>
    (
      await prisma.providerConnection.findMany({
        where: { userId: ctx.principal.userId, deletedAt: null },
        select: publicSelect,
        orderBy: { createdAt: 'desc' },
      })
    ).map(toPublic),
  ),
  create: privateProcedure
    .input(CreateProviderConnectionSchema)
    .mutation(async ({ input, ctx }) => {
      const connectionId = crypto.randomUUID()
      const encrypted = encryptProviderSecret(input.apiKey, {
        userId: ctx.principal.userId,
        connectionId,
        provider: input.provider,
        version: 1,
      })
      const connection = await prisma.$transaction(async (tx) => {
        const count = await tx.providerConnection.count({
          where: { userId: ctx.principal.userId, deletedAt: null },
        })
        if (input.makeDefault || count === 0)
          await tx.providerConnection.updateMany({
            where: {
              userId: ctx.principal.userId,
              isDefault: true,
              deletedAt: null,
            },
            data: { isDefault: false },
          })
        return tx.providerConnection.create({
          data: {
            id: connectionId,
            userId: ctx.principal.userId,
            provider: providerDb(input.provider),
            label: input.label,
            modelId: input.modelId,
            isDefault: input.makeDefault || count === 0,
            secretCiphertext: encrypted.ciphertext,
            secretIv: encrypted.iv,
            secretAuthTag: encrypted.authTag,
            secretLastFour: input.apiKey.slice(-4),
          },
          select: publicSelect,
        })
      })
      return toPublic(connection)
    }),
  update: privateProcedure
    .input(UpdateProviderConnectionSchema)
    .mutation(async ({ input, ctx }) => {
      await ownedConnection(ctx.principal.userId, input.id)
      const connection = await prisma.$transaction(async (tx) => {
        if (input.isDefault)
          await tx.providerConnection.updateMany({
            where: {
              userId: ctx.principal.userId,
              isDefault: true,
              deletedAt: null,
            },
            data: { isDefault: false },
          })
        return tx.providerConnection.update({
          where: { id: input.id },
          data: {
            label: input.label,
            modelId: input.modelId,
            isActive: input.isActive,
            isDefault: input.isDefault,
          },
          select: publicSelect,
        })
      })
      return toPublic(connection)
    }),
  rotate: privateProcedure
    .input(RotateProviderConnectionSchema)
    .mutation(async ({ input, ctx }) => {
      const current = await ownedConnection(ctx.principal.userId, input.id)
      const version = current.secretVersion + 1
      const encrypted = encryptProviderSecret(input.apiKey, {
        userId: ctx.principal.userId,
        connectionId: current.id,
        provider: current.provider.toLowerCase(),
        version,
      })
      const connection = await prisma.providerConnection.update({
        where: { id: current.id },
        data: {
          secretVersion: version,
          secretCiphertext: encrypted.ciphertext,
          secretIv: encrypted.iv,
          secretAuthTag: encrypted.authTag,
          secretLastFour: input.apiKey.slice(-4),
          probedAt: null,
          lastProbeError: null,
        },
        select: publicSelect,
      })
      return toPublic(connection)
    }),
  remove: privateProcedure
    .input(ConnectionIdInputSchema)
    .mutation(async ({ input, ctx }) => {
      const connection = await ownedConnection(ctx.principal.userId, input.id)
      await prisma.providerConnection.update({
        where: { id: connection.id },
        data: {
          deletedAt: new Date(),
          isActive: false,
          isDefault: false,
          secretCiphertext: '',
          secretIv: '',
          secretAuthTag: '',
        },
      })
    }),
  probe: privateProcedure
    .input(ConnectionIdInputSchema)
    .mutation(async ({ input, ctx }) => {
      const connection = await ownedConnection(ctx.principal.userId, input.id)
      let healthy = false
      try {
        const apiKey = decryptProviderSecret(
          {
            ciphertext: connection.secretCiphertext,
            iv: connection.secretIv,
            authTag: connection.secretAuthTag,
          },
          {
            userId: ctx.principal.userId,
            connectionId: connection.id,
            provider: connection.provider.toLowerCase(),
            version: connection.secretVersion,
          },
        )
        const provider = new LLMProviderFactory().create({
          provider: connection.provider.toLowerCase() as 'openai' | 'claude',
          modelId: connection.modelId,
          apiKey,
          maxTokens: 1,
          timeout: 10_000,
          agentInstructions: 'Health probe.',
        })
        healthy = await provider.isEngineHealthy()
        if (!healthy) throw new Error('Provider rejected connection')
      } catch {
        healthy = false
      }
      return persistProbeResult(connection, healthy)
    }),
} satisfies TRPCRouterRecord
