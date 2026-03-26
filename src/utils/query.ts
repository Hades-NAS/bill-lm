import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type { TRPCClientErrorLike } from '@trpc/client'

type QueryResult = UseQueryResult<unknown, TRPCClientErrorLike<any>>

type MutationResult = UseMutationResult<any, TRPCClientErrorLike<any>, any, any>

export const isLoadingQuery = (
  ...results: Array<QueryResult> | Array<UseQueryResult>
) => {
  return results.some((r) => r.isLoading)
}

export const isLoadingOrRefetchQuery = (
  ...results: Array<UseQueryResult> | Array<QueryResult>
) => {
  return results.some((r) => r.isFetching || r.isLoading)
}

export const isRefetchingQuery = (...results: Array<QueryResult>) => {
  return results.some((r) => r.isFetching)
}

export const isLoadingMutation = (...results: Array<MutationResult>) => {
  return results.some((r) => r.isPending)
}

export const isErrorQuery = (...results: Array<QueryResult>) => {
  return results.some((r) => r.isError)
}

export const isSuccessQuery = (...results: Array<QueryResult>) => {
  return results.every((r) => r.isSuccess)
}

export const isSuccessWithDataQuery = (...results: Array<QueryResult>) => {
  return results.every((r) =>
    r.isSuccess && r.data !== undefined && Array.isArray(r.data)
      ? r.data.length > 0
      : false,
  )
}

export const isEmptyArrayQuery = (query: QueryResult | undefined) => {
  return (
    query !== undefined &&
    query.isSuccess &&
    Array.isArray(query.data) &&
    query.data.length === 0
  )
}
