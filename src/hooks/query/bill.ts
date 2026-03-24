import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "#/integrations/trpc/react";

import { useUserAuth } from "../auth";

export const useGetBillDetailQuery = (billId?: string | null) => {
  const auth = useUserAuth();
  const trpc = useTRPC();

  return useQuery(trpc.bills.getBillDetailById.queryOptions({
    auth,
    data: { billId: billId! }
  }, {
    enabled: !!billId
  }));
}