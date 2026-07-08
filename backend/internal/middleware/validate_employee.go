package middleware

import (
	"database/sql"
	"net/http"

	"github.com/pms/backend/pkg/utils"
)

// ValidateEmployee confirms the employee_id from the JWT still exists and
// is active in the database. This catches stale tokens after a DB reset or
// if an account is disabled between logins.
//
// Call this AFTER AuthMiddleware in the middleware chain.
func ValidateEmployee(db *sql.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			empID := GetEmployeeID(r)
			if empID.String() == "00000000-0000-0000-0000-000000000000" {
				// AuthMiddleware already rejected this; won't reach here normally.
				utils.Unauthorized(w, "Not authenticated")
				return
			}

			var isActive bool
			err := db.QueryRow(
				`SELECT is_active FROM employees WHERE id = $1`, empID,
			).Scan(&isActive)

			if err == sql.ErrNoRows {
				// Token references an employee that no longer exists (e.g. after
				// a DB reset). Force re-login.
				utils.Unauthorized(w, "Session expired — please log in again")
				return
			}
			if err != nil {
				utils.InternalError(w, "Authentication check failed")
				return
			}
			if !isActive {
				utils.Unauthorized(w, "Your account has been disabled")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
