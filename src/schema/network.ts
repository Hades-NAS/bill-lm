import type { TRPCClientErrorLike } from '@trpc/client'

export type MutationOptions<TData = unknown> = {
  gcTime?: number
  retryDelay?: number
  retry?: boolean | number
  onBefore?: () => void
  onSuccess?: (data: TData) => void
  onError?: (error: TRPCClientErrorLike<any>) => void
  onSettled?: (data?: TData, error?: TRPCClientErrorLike<any> | null) => void
}

export type QueryOptions = {
  gcTime?: number
  staleTime?: number
  retryDelay?: number
  retry?: boolean | number
  // onSuccess?: (data: TData) => void;
  // onError?: (error: TRPCErrorResponse<TRPCErrorShape<object>>) => void;
  // onSettled?: (data?: TData, error?: TError | null) => void;
}
