package auth

import (
	"errors"
	"os"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Claims embeds the standard JWT claims plus our custom fields.
type Claims struct {
	UserID       string `json:"user_id"`
	DepartmentID string `json:"department_id"`
	Role         string `json:"role"`        // admin | layer2 | layer3
	DeptLayer    int    `json:"dept_layer"`  // 0 for admin, 2 or 3
	jwt.RegisteredClaims
}

func jwtSecret() []byte {
	s := os.Getenv("JWT_SECRET")
	if s == "" {
		panic("JWT_SECRET is not set")
	}
	return []byte(s)
}

func jwtExpiry() time.Duration {
	h, _ := strconv.Atoi(os.Getenv("JWT_EXPIRY_HOURS"))
	if h == 0 {
		h = 8
	}
	return time.Duration(h) * time.Hour
}

// GenerateToken mints a signed JWT for the given user.
func GenerateToken(userID, deptID, role string, deptLayer int) (string, error) {
	jti := uuid.NewString()
	claims := &Claims{
		UserID:       userID,
		DepartmentID: deptID,
		Role:         role,
		DeptLayer:    deptLayer,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(jwtExpiry())),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(jwtSecret())
}

// ParseToken validates and parses the JWT string.
func ParseToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return jwtSecret(), nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
