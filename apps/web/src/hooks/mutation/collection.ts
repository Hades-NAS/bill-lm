import { useMutation, useQueryClient } from '@tanstack/react-query'
import { DateTime } from 'luxon'

import { useJobsStore } from '#/integrations/store/jobs.store'
import { getContext } from '#/integrations/tanstack-query/root-provider'
import { useTRPC } from '#/integrations/trpc/react'

import { notify } from '#/utils/notifications'

import { useUserAuth } from '../auth'
import { invalidateQueriesByKeys } from '../invalidate-utils'

import type {
  CreateCollectionType,
  UpdateCollectionType,
} from '#/schema/collections'
import type { MutationOptions } from '#/schema/network'

export const CREATE_COLLECTION_INVALIDATION_KEYS = () => {
  const { trpc } = getContext()
  return [trpc.collections.list.queryKey()]
}

export const useCollectionCreateMutation = (
  options: MutationOptions<CreateCollectionType> = {},
) => {
  const queryClient = useQueryClient()
  const trpc = useTRPC()

  return useMutation(
    trpc.collections.create.mutationOptions({
      ...options,
      onSuccess: (data) => {
        invalidateQueriesByKeys(
          queryClient,
          CREATE_COLLECTION_INVALIDATION_KEYS(),
        )
        options.onSuccess?.(data)
      },
      onError: (error) => {
        console.error('Error creating collection:', error)
        options.onError?.(error)
        notify.error({
          title: 'Error al crear colección',
          message:
            error.message ||
            'Ocurrió un error al crear tu colección. Por favor, intenta de nuevo.',
        })
      },
    }),
  )
}

export const UPDATE_COLLECTION_INVALIDATION_KEYS = (id: string) => {
  const { trpc } = getContext()
  return [
    trpc.collections.list.queryKey(),
    trpc.collections.detail.queryKey({ id }),
  ]
}

export const useCollectionUpdateMutation = (
  options: MutationOptions<UpdateCollectionType> = {},
) => {
  const queryClient = useQueryClient()
  const trpc = useTRPC()

  return useMutation(
    trpc.collections.update.mutationOptions({
      ...options,
      onSuccess: (data) => {
        invalidateQueriesByKeys(
          queryClient,
          UPDATE_COLLECTION_INVALIDATION_KEYS(data.id),
        )
        options.onSuccess?.(data)
        notify.success({
          title: 'Colección guardada',
          message: 'Tu colección ha sido guardada exitosamente.',
        })
      },
      onError: (error) => {
        options.onError?.(error)
        notify.error({
          title: 'Error al guardar colección',
          message:
            error.message ||
            'Ocurrió un error al guardar tu colección. Por favor, intenta de nuevo.',
        })
      },
    }),
  )
}

export const useCollectionDeleteMutation = (
  options: MutationOptions<string> = {},
) => {
  const queryClient = useQueryClient()
  const trpc = useTRPC()

  return useMutation(
    trpc.collections.delete.mutationOptions({
      onSuccess: (data) => {
        invalidateQueriesByKeys(
          queryClient,
          CREATE_COLLECTION_INVALIDATION_KEYS(),
        )
        options.onSuccess?.(data.id)
        notify.success({
          title: 'Colección archivada',
          message:
            'La colección dejó de mostrarse, pero su historial se conserva.',
        })
      },
      onError: (error) => {
        options.onError?.(error)
        notify.error({
          title: 'No se pudo eliminar la colección',
          message:
            error.message ||
            'Ocurrió un error al eliminar la colección. Inténtalo de nuevo.',
        })
      },
    }),
  )
}

export const useAnalyzeCollectionMutation = (
  options: MutationOptions<{ jobId: string; collectionId: string }> = {},
) => {
  const queryClient = useQueryClient()
  const trpc = useTRPC()
  const auth = useUserAuth()
  const addJob = useJobsStore((state) => state.addJob)

  return useMutation(
    trpc.collections.analyze.mutationOptions({
      ...options,
      onSuccess: (data) => {
        // Add job to global store - subscription manager will handle Firestore subscription
        addJob({
          jobId: data.jobId,
          firebaseUid: auth.userId,
          credentialId: null,
          data: {
            collectionName: data.collectionName,
            collectionId: data.collectionId,
            type: 'all', // Default - will be updated by Firestore
            billIds: [],
          },
          percentage: 0,
          status: 'pending',
          createdAt: DateTime.now().toJSDate(),
          updatedAt: DateTime.now().toJSDate(),
          callCount: 0,
          totalTokens: 0,
          deletedAt: null,
          read: false,
        })

        invalidateQueriesByKeys(
          queryClient,
          UPDATE_COLLECTION_INVALIDATION_KEYS(data.collectionId),
        )
        options.onSuccess?.(data)
        notify.success({
          title: 'Análisis iniciado',
          message:
            'El análisis de tu colección ha sido iniciado. Recibirás una notificación cuando esté completo.',
        })
      },
      onError: (error) => {
        console.error('Error starting analysis:', error)
        options.onError?.(error)
        notify.error({
          title: 'Error al iniciar análisis',
          message:
            error.message ||
            'Ocurrió un error al iniciar el análisis de tu colección. Por favor, intenta de nuevo.',
        })
      },
    }),
  )
}
