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
  }));
}
