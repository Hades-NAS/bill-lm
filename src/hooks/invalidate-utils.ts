import type { QueryClient } from '@tanstack/react-query'

export const invalidateQueriesByKeys = async (
  queryClient: QueryClient,
  arrayKeys: Array<Array<any>>,
) => {
  return Promise.all(
    arrayKeys.map(async (key) => {
      return await queryClient.invalidateQueries({
        queryKey: key,
        refetchType: 'all',
        exact: false,
        type: 'all',
      })
    }),
  )
}
