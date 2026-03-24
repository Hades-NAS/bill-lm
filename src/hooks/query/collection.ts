import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "#/integrations/trpc/react";

import { useUserAuth } from "../auth";

import type { GetCollectionsRequest } from "#/schema/collections";


export const useGetCollectionsQuery = (data: GetCollectionsRequest) => {
  const auth = useUserAuth();
  const trpc = useTRPC();

  return useQuery(trpc.collections.list.queryOptions({
    auth,
    data
  }, {
    enabled: !!auth.isSignedIn && auth.isLoaded,
  }));
}

export const useGetCollectionByIdQuery = (id: string) => {
  const auth = useUserAuth();
  const trpc = useTRPC();

  return useQuery(trpc.collections.detail.queryOptions({
    auth,
    data: { id }
  }, {
    enabled: !!id && !!auth.isSignedIn && auth.isLoaded,
  }));
}
