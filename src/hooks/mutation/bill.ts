import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getContext } from '#/integrations/tanstack-query/root-provider'
import { useTRPC } from '#/integrations/trpc/react'
import { parseAndValidateInvoiceXML } from '#/integrations/xml'

import { notify } from '#/utils/notifications'

import { invalidateQueriesByKeys } from '../invalidate-utils'

import type { MutationOptions } from '#/schema/network'
import type { FileWithPath } from '@mantine/dropzone'

export const UPDATE_BILLS_INVALIDATION_KEYS = (id: string) => {
  const { trpc } = getContext()
  return [
    trpc.collections.list.queryKey(),
    trpc.collections.detail.queryKey({ id }),
  ]
}

export const useUploadBillsMutation = (
  options: MutationOptions<string> = {},
) => {
  const queryClient = useQueryClient()
  const trpc = useTRPC()

  return useMutation(
    trpc.bills.uploadBills.mutationOptions({
      onSuccess: (data) => {
        invalidateQueriesByKeys(
          queryClient,
          UPDATE_BILLS_INVALIDATION_KEYS(data.collectionId),
        )
        options.onSuccess?.(data.collectionId)
        notify.success({
          title: 'Facturas subidas',
          message: 'Tus facturas han sido subidas exitosamente.',
        })
      },
      onError: (error) => {
        options.onError?.(error)
        notify.error({
          title: 'Error al subir facturas',
          message:
            'Ocurrió un error al subir tus facturas. Por favor, intenta de nuevo.',
        })
      },
    }),
  )
}

export const useDeleteBillsMutation = (
  options: MutationOptions<string> = {},
) => {
  const queryClient = useQueryClient()
  const trpc = useTRPC()

  return useMutation(
    trpc.bills.deleteBills.mutationOptions({
      onSuccess: (data) => {
        invalidateQueriesByKeys(
          queryClient,
          UPDATE_BILLS_INVALIDATION_KEYS(data.collectionId),
        )
        options.onSuccess?.(data.collectionId)
        notify.success({
          title: 'Facturas eliminada(s)',
          message: 'Las facturas han sido eliminadas exitosamente.',
        })
      },
      onError: (error) => {
        options.onError?.(error)
        notify.error({
          title: 'Error al eliminar facturas',
          message:
            'Ocurrió un error al eliminar tus facturas. Por favor, intenta de nuevo.',
        })
      },
    }),
  )
}

export const useMarkAsReadMutation = (options: MutationOptions<void> = {}) => {
  // const queryClient = useQueryClient()
  const trpc = useTRPC()

  return useMutation(
    trpc.collections.markAsRead.mutationOptions({
      ...options,
      onSuccess: () => {
        options.onSuccess?.()
      },
      onError: (error) => {
        options.onError?.(error)
        notify.error({
          title: 'Error al marcar trabajos como leídos',
          message:
            'Ocurrió un error al marcar los trabajos como leídos. Por favor, intenta de nuevo.',
        })
      },
    }),
  )
}

type PreprocessBillResult = {
  bills: Array<FileWithPath>
  errors: Array<{ file: FileWithPath; error: string }>
}

export const usePreprocessBillMutation = (
  options: MutationOptions<PreprocessBillResult> = {},
) => {
  return useMutation({
    mutationFn: async (bills: Array<FileWithPath>) => {
      const results: PreprocessBillResult = {
        bills: [],
        errors: [],
      }

      for (const billFile of bills) {
        const buffer = await billFile.arrayBuffer()
        const xmlString = new TextDecoder().decode(buffer)
        const bill = parseAndValidateInvoiceXML(xmlString)

        if (!bill.success) {
          console.error('Error parsing bill XML:', bill.error)
          results.errors.push({
            file: billFile,
            error: 'No pudimos leer este archivo como una factura XML válida.',
          })
          continue
        }

        results.bills.push(billFile)
      }
      return results
    },
    onSuccess: (data) => {
      options.onSuccess?.(data)
    },
    onError: (error) => {
      console.error('Error preprocessing bills:', error)
      options.onError?.(error)
      notify.error({
        title: 'Error al procesar facturas',
        message:
          'Ocurrió un error al procesar tus facturas. Por favor, intenta de nuevo.',
      })
    },
  })
}
