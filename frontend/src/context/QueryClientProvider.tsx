import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

/**
 * React Query Configuration
 * No caching - all data is fetched fresh from backend
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is immediately stale - always refetch
            staleTime: 0,

            // No cache - data is garbage collected immediately
            gcTime: 0,

            // Retry failed requests once
            retry: 1,

            // Refetch on window focus (user returns to tab)
            refetchOnWindowFocus: true,

            // Refetch on reconnect (network recovery)
            refetchOnReconnect: true,

            // Always refetch on mount since no caching
            refetchOnMount: true,
          },
          mutations: {
            // Retry mutations once
            retry: 1,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
