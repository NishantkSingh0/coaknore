package middleware

import (
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
	"pms/backend/pkg/response"
)

type ipLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

var (
	mu       sync.Mutex
	limiters = make(map[string]*ipLimiter)
)

func init() {
	// Cleanup stale limiters every 5 minutes
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			mu.Lock()
			for ip, il := range limiters {
				if time.Since(il.lastSeen) > 10*time.Minute {
					delete(limiters, ip)
				}
			}
			mu.Unlock()
		}
	}()
}

func getLimiter(ip string) *rate.Limiter {
	mu.Lock()
	defer mu.Unlock()
	il, exists := limiters[ip]
	if !exists {
		il = &ipLimiter{limiter: rate.NewLimiter(rate.Every(time.Minute/100), 100)}
		limiters[ip] = il
	}
	il.lastSeen = time.Now()
	return il.limiter
}

// RateLimit applies per-IP rate limiting (100 req/min).
func RateLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		if !getLimiter(ip).Allow() {
			response.Error(w, http.StatusTooManyRequests, "RATE_LIMITED", "too many requests", "")
			return
		}
		next.ServeHTTP(w, r)
	})
}
