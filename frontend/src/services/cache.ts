/**
 * In-Memory Cache Service
 * Stores API responses temporarily to reduce server load
 * Cache is automatically cleared on page refresh (in-memory only)
 * No time-based expiration - cache only cleared on refresh or explicit invalidation
 */

interface CacheEntry<T> {
  data: T
}

class CacheService {
  private cache = new Map<string, CacheEntry<unknown>>()

  /**
   * Generate a cache key from URL and params
   */
  private generateKey(url: string, params?: Record<string, unknown>): string {
    if (!params || Object.keys(params).length === 0) {
      return url
    }
    const paramString = JSON.stringify(params, Object.keys(params).sort())
    return `${url}:${paramString}`
  }

  /**
   * Get cached data if exists
   */
  get<T>(url: string, params?: Record<string, unknown>): T | null {
    const key = this.generateKey(url, params)
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    return entry.data as T
  }

  /**
   * Set data in cache (no expiration)
   */
  set<T>(url: string, data: T, params?: Record<string, unknown>): void {
    const key = this.generateKey(url, params)
    const entry: CacheEntry<T> = {
      data,
    }
    this.cache.set(key, entry)
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(url: string, params?: Record<string, unknown>): void {
    const key = this.generateKey(url, params)
    this.cache.delete(key)
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string): void {
    const keys = Array.from(this.cache.keys())
    keys.forEach(key => {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    })
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService()

// Export cache decorator for API methods
export function withCache<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => { url: string; params?: Record<string, unknown> }
): T {
  return (async (...args: Parameters<T>) => {
    const { url, params } = keyGenerator(...args)

    // Try to get from cache
    const cached = cacheService.get<ReturnType<T>>(url, params)
    if (cached !== null) {
      return cached
    }

    // Fetch from API
    const result = await fn(...args)

    // Cache the result
    cacheService.set(url, result, params)

    return result
  }) as T
}
