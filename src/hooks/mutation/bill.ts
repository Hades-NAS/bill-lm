import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getContext } from "#/integrations/tanstack-query/root-provider";
import { useTRPC } from "#/integrations/trpc/react";

import { notify } from "#/utils/notifications";

import { invalidateQueriesByKeys } from "../invalidate-utils";

import type { MutationOptions } from "#/schema/network";


export const UPDATE_BILLS_INVALIDATION_KEYS = (id: string) => {
  const { trpc } = getContext();
  return [
    trpc.collections.list.queryKey(),
    trpc.collections.detail.queryKey({ data: { id } }),
  ]
}

export const useUploadBillsMutation = (options: MutationOptions<string> = {}) => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(trpc.bills.uploadBills.mutationOptions({
    onSuccess: (data) => {
      invalidateQueriesByKeys(
        queryClient,
        UPDATE_BILLS_INVALIDATION_KEYS(data.collectionId)
      );
      options.onSuccess?.(data.collectionId);
      notify.success({
        title: 'Facturas subidas',
        message: 'Tus facturas han sido subidas exitosamente.',
      })
    },
    onError: (error) => {
      options.onError?.(error);
      notify.error({
        title: 'Error al subir facturas',
        message: 'Ocurrió un error al subir tus facturas. Por favor, intenta de nuevo.',
      })
    }
  }));
}

export const useDeleteBillsMutation = (options: MutationOptions<string> = {}) => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(trpc.bills.deleteBills.mutationOptions({
    onSuccess: (data) => {
      invalidateQueriesByKeys(
        queryClient,
        UPDATE_BILLS_INVALIDATION_KEYS(data.collectionId)
      );
      options.onSuccess?.(data.collectionId);
      notify.success({
        title: 'Facturas eliminada(s)',
        message: 'Las facturas han sido eliminadas exitosamente.',
      })
    },
    onError: (error) => {
      options.onError?.(error);
      notify.error({
        title: 'Error al eliminar facturas',
        message: 'Ocurrió un error al eliminar tus facturas. Por favor, intenta de nuevo.',
      })
    }
  }));
}
