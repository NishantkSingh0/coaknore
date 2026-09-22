import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

/**
 * React Query Configuration
 * Balances speed and freshness with smart caching strategies
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is fresh for 2 minutes - no refetches needed
            staleTime: 2 * 60 * 1000,
            
            // Keep data in cache for 10 minutes before garbage collection
            gcTime: 10 * 60 * 1000,
            
            // Retry failed requests once
            retry: 1,
            
            // Refetch on window focus (user returns to tab)
            refetchOnWindowFocus: true,
            
            // Refetch on reconnect (network recovery)
            refetchOnReconnect: true,
            
            // Don't refetch on mount if data is fresh
            refetchOnMount: false,
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
