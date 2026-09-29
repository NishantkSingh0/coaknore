package config

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

var RedisClient *redis.Client

// InitRedis initializes the Redis client with connection pooling
func InitRedis() error {
	opt, err := redis.ParseURL(App.RedisURL)
	if err != nil {
		return fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	// Configure connection pool for optimal performance
	opt.PoolSize = 15                    // Maximum number of socket connections
	opt.MinIdleConns = 5                 // Minimum number of idle connections
	opt.MaxRetries = 3                   // Maximum number of retries
	opt.DialTimeout = 5 * time.Second     // Dial timeout
	opt.ReadTimeout = 3 * time.Second    // Read timeout
	opt.WriteTimeout = 3 * time.Second   // Write timeout
	opt.PoolTimeout = 4 * time.Second     // Connection pool timeout

	RedisClient = redis.NewClient(opt)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := RedisClient.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}

	log.Println("Redis connected successfully")
	return nil
}

// CloseRedis closes the Redis connection
func CloseRedis() error {
	if RedisClient != nil {
		return RedisClient.Close()
	}
	return nil
}

// IsRedisAvailable checks if Redis is available
func IsRedisAvailable() bool {
	if RedisClient == nil {
		return false
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	return RedisClient.Ping(ctx).Err() == nil
}
