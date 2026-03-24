import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "#/integrations/trpc/react";

import { useUserAuth } from "../auth";

export const useGetJobStatsQuery = (jobId?: string | null) => {
  const auth = useUserAuth();
  const trpc = useTRPC();

  return useQuery(trpc.telemetry.getJobStats.queryOptions(
    { jobId: jobId! },
    {
      enabled: !!jobId && !!auth.isSignedIn && auth.isLoaded,
    }
  ));
};

export const useGetAgentCallsQuery = (jobId?: string | null, limit: number = 50) => {
  const auth = useUserAuth();
  const trpc = useTRPC();

  return useQuery(trpc.telemetry.getAgentCalls.queryOptions(
    { jobId: jobId!, limit },
    {
      enabled: !!jobId && !!auth.isSignedIn && auth.isLoaded,
    }
  ));
};

export const useGetUserMetricsQuery = () => {
  const auth = useUserAuth();
  const trpc = useTRPC();

  return useQuery(trpc.telemetry.getUserMetrics.queryOptions({
    auth,
    data: {}
  }, {
    enabled: !!auth.isSignedIn && auth.isLoaded,
  }));
};

export const useGetUserJobsQuery = (limit: number = 50) => {
  const auth = useUserAuth();
  const trpc = useTRPC();

  return useQuery(trpc.telemetry.getUserJobs.queryOptions({
    auth,
    data: { limit }
  }, {
    enabled: !!auth.isSignedIn && auth.isLoaded,
  }));
};
