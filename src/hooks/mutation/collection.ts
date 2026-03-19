import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getContext } from "#/integrations/tanstack-query/root-provider";
import { useTRPC } from "#/integrations/trpc/react";

import { notify } from "#/utils/notifications";

import { invalidateQueriesByKeys } from "../invalidate-utils";

import type { CreateCollectionType, UpdateCollectionType } from "#/schema/collections";
import type { MutationOptions } from "#/schema/network"


export const CREATE_COLLECTION_INVALIDATION_KEYS = () => {
  const { trpc } = getContext();
  return [
    trpc.collections.list.queryKey(),
  ]
}

export const useCollectionCreateMutation = (options: MutationOptions<CreateCollectionType> = {}) => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(trpc.collections.create.mutationOptions({
    ...options,
    onSuccess: async (data) => {
      await invalidateQueriesByKeys(
        queryClient,
        CREATE_COLLECTION_INVALIDATION_KEYS()
      );
      options.onSuccess?.(data);
    },
    onError: (error) => {
      console.error('Error creating collection:', error);
      options.onError?.(error);
      notify.error({
        title: 'Error al crear colección',
        message: 'Ocurrió un error al crear tu colección. Por favor, intenta de nuevo.',
      })
    }
  }));
}

export const UPDATE_COLLECTION_INVALIDATION_KEYS = (id: string) => {
  const { trpc } = getContext();
  return [
    trpc.collections.list.queryKey(),
    trpc.collections.detail.queryKey({ data: { id } }),
  ]
}

export const useCollectionUpdateMutation = (options: MutationOptions<UpdateCollectionType> = {}) => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  return useMutation(trpc.collections.update.mutationOptions({
    ...options,
    onSuccess: async (data) => {
      await invalidateQueriesByKeys(
        queryClient,
        UPDATE_COLLECTION_INVALIDATION_KEYS(data.id)
      );
      options.onSuccess?.(data);
      notify.success({
        title: 'Colección guardada',
        message: 'Tu colección ha sido guardada exitosamente.',
      })
    },
    onError: (error) => {
      options.onError?.(error);
      notify.error({
        title: 'Error al guardar colección',
        message: 'Ocurrió un error al guardar tu colección. Por favor, intenta de nuevo.',
      })
    }
  }));
}
