import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getContext } from '#/integrations/tanstack-query/root-provider'
import { useTRPC } from '#/integrations/trpc/react'
import { parseAndValidateInvoiceXML } from '#/integrations/xml'

import { notify } from '#/utils/notifications'

import { invalidateQueriesByKeys } from '../invalidate-utils'

import type { BillFormData } from '#/components/bill/form'
import type { Factura } from '#/schema/bill'
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
  params: Partial<BillFormData>,
  options: MutationOptions<PreprocessBillResult> = {},
) => {
  return useMutation({
    mutationFn: async (bills: Array<FileWithPath>) => {
      const { personalIdNumber, professionalIdNumber } = params

      const results: PreprocessBillResult = {
        bills: [],
        errors: [],
      }

      if (!personalIdNumber) {
        notify.error({
          title: 'Número de cédula requerido',
          message:
            'Por favor, proporciona un número de cédula para validar las facturas.',
        })
        return results
      }

      const billsData: Array<{ file: FileWithPath; factura: Factura }> = []

      for (const billFile of bills) {
        const buffer = await billFile.arrayBuffer()
        const xmlString = new TextDecoder().decode(buffer)
        const bill = parseAndValidateInvoiceXML(xmlString)

        if (!bill.success) {
          console.error('Error parsing bill XML:', bill.error)
          continue
        }

        billsData.push({ file: billFile, factura: bill.data.factura })
      }

      billsData.forEach((bill) => {
        const idBuyer =
          bill.factura.infoFactura.identificacionComprador.trim() || ''

        if (idBuyer.length === 10) {
          if (idBuyer === personalIdNumber) {
            results.bills.push(bill.file)
          } else {
            results.errors.push({
              file: bill.file,
              error: `Cédula del comprador (${idBuyer}) no coincide con la proporcionada (${personalIdNumber}).`,
            })
          }
        }
        if (idBuyer.length === 13) {
          if (!professionalIdNumber) {
            results.errors.push({
              file: bill.file,
              error: `Factura contiene RUC del comprador (${idBuyer}) pero no se proporcionó un RUC para validar.`,
            })
            return
          }

          if (idBuyer === professionalIdNumber) {
            results.bills.push(bill.file)
          } else {
            results.errors.push({
              file: bill.file,
              error: `RUC del comprador (${idBuyer}) no coincide con el proporcionado (${professionalIdNumber}).`,
            })
          }
        }
      })
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
