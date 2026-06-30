package auth

import "context"

type ctxKey string

const claimsCtxKey ctxKey = "claims"

// ContextWithClaims stores claims in the given context.
func ContextWithClaims(ctx context.Context, c *Claims) context.Context {
	return context.WithValue(ctx, claimsCtxKey, c)
}

// ClaimsFromCtx retrieves Claims from the context.
func ClaimsFromCtx(ctx context.Context) *Claims {
	c, _ := ctx.Value(claimsCtxKey).(*Claims)
	return c
}
