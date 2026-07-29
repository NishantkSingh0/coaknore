import { useEffect } from 'react'
import { cacheService } from '../services/cache'

/**
 * Hook to clear cache on page refresh
 * This ensures fresh data is fetched when the user refreshes the page
 */
export function useCacheClear() {
  useEffect(() => {
    // Clear cache on mount (page refresh or initial load)
    cacheService.clear()
  }, [])
}
