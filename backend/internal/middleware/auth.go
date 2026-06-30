package middleware

import (
	"net/http"
	"strings"

	"pms/backend/internal/auth"
	"pms/backend/pkg/response"
)

// JWTAuth validates the Bearer token and stores claims in context.
func JWTAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			response.Error(w, http.StatusUnauthorized, "MISSING_TOKEN", "authorization token required", "")
			return
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims, err := auth.ParseToken(tokenStr)
		if err != nil {
			response.Error(w, http.StatusUnauthorized, "INVALID_TOKEN", "invalid or expired token", "")
			return
		}
		ctx := auth.ContextWithClaims(r.Context(), claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRoles blocks requests whose role is not in the allowed list.
func RequireRoles(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := auth.ClaimsFromCtx(r.Context())
			if claims == nil || !allowed[claims.Role] {
				response.Error(w, http.StatusForbidden, "FORBIDDEN", "insufficient permissions", "")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
