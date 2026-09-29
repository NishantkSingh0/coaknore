package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/pms/backend/internal/config"
	"github.com/redis/go-redis/v9"
)

// CacheService handles caching operations with Redis
type CacheService struct {
	client *redis.Client
}

// NewCacheService creates a new cache service
func NewCacheService() *CacheService {
	return &CacheService{
		client: config.RedisClient,
	}
}

// CacheTTL defines default cache durations
const (
	TTLShort  = 5 * time.Minute   // 5 minutes - frequently changing data
	TTLMedium = 15 * time.Minute  // 15 minutes - moderately changing data
	TTLLong   = 1 * time.Hour     // 1 hour - rarely changing data
	TTLVeryLong = 24 * time.Hour  // 24 hours - static data
)

// Get retrieves a value from cache
func (s *CacheService) Get(ctx context.Context, key string, dest interface{}) error {
	if s.client == nil || !config.IsRedisAvailable() {
		return redis.Nil // Treat as cache miss
	}

	val, err := s.client.Get(ctx, key).Result()
	if err != nil {
		return err
	}

	return json.Unmarshal([]byte(val), dest)
}

// Set stores a value in cache with TTL
func (s *CacheService) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	if s.client == nil || !config.IsRedisAvailable() {
		return nil // Silently fail if Redis unavailable
	}

	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal cache value: %w", err)
	}

	return s.client.Set(ctx, key, data, ttl).Err()
}

// Delete removes a value from cache
func (s *CacheService) Delete(ctx context.Context, keys ...string) error {
	if s.client == nil || !config.IsRedisAvailable() {
		return nil
	}

	if len(keys) == 0 {
		return nil
	}

	return s.client.Del(ctx, keys...).Err()
}

// DeleteByPattern removes all keys matching a pattern
func (s *CacheService) DeleteByPattern(ctx context.Context, pattern string) error {
	if s.client == nil || !config.IsRedisAvailable() {
		return nil
	}

	iter := s.client.Scan(ctx, 0, pattern, 0).Iterator()
	keys := []string{}

	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}

	if err := iter.Err(); err != nil {
		return err
	}

	if len(keys) > 0 {
		return s.client.Del(ctx, keys...).Err()
	}

	return nil
}

// InvalidateCacheByOrg invalidates all cache keys for a specific organization
func (s *CacheService) InvalidateCacheByOrg(ctx context.Context, orgID string) error {
	pattern := fmt.Sprintf("org:%s:*", orgID)
	return s.DeleteByPattern(ctx, pattern)
}

// InvalidateCacheByDepartment invalidates all cache keys for a specific department
func (s *CacheService) InvalidateCacheByDepartment(ctx context.Context, deptID string) error {
	pattern := fmt.Sprintf("dept:%s:*", deptID)
	return s.DeleteByPattern(ctx, pattern)
}

// InvalidateCacheByProject invalidates all cache keys for a specific project
func (s *CacheService) InvalidateCacheByProject(ctx context.Context, projectID string) error {
	pattern := fmt.Sprintf("project:%s:*", projectID)
	return s.DeleteByPattern(ctx, pattern)
}

// GetOrSet retrieves a value from cache or executes the function to get it
func (s *CacheService) GetOrSet(ctx context.Context, key string, ttl time.Duration, fn func() (interface{}, error), dest interface{}) error {
	// Try to get from cache first
	err := s.Get(ctx, key, dest)
	if err == nil {
		return nil // Cache hit
	}

	if err != redis.Nil {
		log.Printf("Cache error (falling back to source): %v", err)
	}

	// Cache miss or error - get from source
	value, err := fn()
	if err != nil {
		return err
	}

	// Set in cache for next time
	if err := s.Set(ctx, key, value, ttl); err != nil {
		log.Printf("Failed to set cache: %v", err)
	}

	// Unmarshal the value into dest
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}

	return json.Unmarshal(data, dest)
}

// GenerateKey creates a cache key with namespace
func GenerateKey(namespace, id string) string {
	return fmt.Sprintf("%s:%s", namespace, id)
}

// GenerateOrgKey creates a cache key for organization-scoped data
func GenerateOrgKey(orgID, resource string) string {
	return fmt.Sprintf("org:%s:%s", orgID, resource)
}

// GenerateDeptKey creates a cache key for department-scoped data
func GenerateDeptKey(deptID, resource string) string {
	return fmt.Sprintf("dept:%s:%s", deptID, resource)
}

// GenerateProjectKey creates a cache key for project-scoped data
func GenerateProjectKey(projectID, resource string) string {
	return fmt.Sprintf("project:%s:%s", projectID, resource)
}
