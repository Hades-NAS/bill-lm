// src/components/query-error-handler.tsx
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export function QueryErrorHandler() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  useEffect(() => {
    // Observer que escucha TODOS los cambios en el cache
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      // Verificar si la query tiene un error en su state
      if (event.query.state.status === 'error') {
        const error = event.query.state.error
        console.error('Query error:', error?.shape?.data?.code)

        if (error?.shape?.data?.code === 'UNAUTHORIZED') {
          console.warn('Unauthorized! Redirecting...')
          navigate({ to: '/' })
          // Then clear state auth and cache
        }
      }
    })

    return () => {
      unsubscribe()
    }
  }, [queryClient, navigate])

  return null
}
