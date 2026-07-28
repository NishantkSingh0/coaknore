package database

import (
	"database/sql"
	"fmt"
	"log"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// SeedConfig holds the default super admin credentials.
// Edit these values before first run.
type SeedConfig struct {
	OrgName   string
	Email     string
	Password  string
	FirstName string
	LastName  string
}

// DefaultSeed is the single source of truth for the initial admin account.
// Change these before deploying; never commit real credentials to version control.
var DefaultSeed = SeedConfig{
	OrgName:   "Furniture Manufacturing Co.",
	Email:     "n@oaknore.in",
	Password:  "O$1234567890",
	FirstName: "Nishant",
	LastName:  "Singh",
}

// RunSeed creates the default organization and super admin if they do not exist.
// It is safe to call on every startup — it is fully idempotent.
func RunSeed(db *sql.DB) {
	orgID, created, err := ensureOrganization(db, DefaultSeed.OrgName)
	if err != nil {
		log.Printf("[seed] organization error: %v", err)
		return
	}
	if created {
		log.Printf("[seed] organization created: %s (%s)", DefaultSeed.OrgName, orgID)
	} else {
		log.Printf("[seed] organization exists: %s (%s)", DefaultSeed.OrgName, orgID)
	}

	adminCreated, err := ensureSuperAdmin(db, orgID, DefaultSeed)
	if err != nil {
		log.Printf("[seed] super admin error: %v", err)
		return
	}
	if adminCreated {
		log.Printf("[seed] super admin created — email: %s", DefaultSeed.Email)
		log.Printf("[seed] ⚠  change the default password after first login!, Current Passwor: %s", DefaultSeed.Password)
	} else {
		log.Printf("[seed] super admin already exists — skipping")
	}
}

// ── helpers ──────────────────────────────────────────────────────────────────

func ensureOrganization(db *sql.DB, name string) (id uuid.UUID, created bool, err error) {
	// Use the first existing org if one already exists.
	scanErr := db.QueryRow(`SELECT id FROM organizations LIMIT 1`).Scan(&id)
	if scanErr == nil {
		return id, false, nil
	}
	if scanErr != sql.ErrNoRows {
		return uuid.Nil, false, fmt.Errorf("query organization: %w", scanErr)
	}

	// None found — create it.
	id = uuid.New()
	_, err = db.Exec(
		`INSERT INTO organizations (id, name, description)
		 VALUES ($1, $2, $3)`,
		id,
		name,
		"Default organization — created automatically on first start",
	)
	if err != nil {
		return uuid.Nil, false, fmt.Errorf("insert organization: %w", err)
	}
	return id, true, nil
}

func ensureSuperAdmin(db *sql.DB, orgID uuid.UUID, cfg SeedConfig) (bool, error) {
	// If an account with this email already exists, do nothing.
	var count int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM employees WHERE email = $1`, cfg.Email,
	).Scan(&count); err != nil {
		return false, fmt.Errorf("check email: %w", err)
	}
	if count > 0 {
		return false, nil
	}

	// Hash password.
	hash, err := bcrypt.GenerateFromPassword([]byte(cfg.Password), bcrypt.DefaultCost)
	if err != nil {
		return false, fmt.Errorf("bcrypt: %w", err)
	}

	id := uuid.New()
	_, err = db.Exec(`
		INSERT INTO employees
			(id, organization_id, email, password_hash,
			 first_name, last_name, layer, is_active)
		VALUES
			($1, $2, $3, $4, $5, $6, 'super_admin', TRUE)
	`,
		id, orgID, cfg.Email, string(hash), cfg.FirstName, cfg.LastName,
	)
	if err != nil {
		return false, fmt.Errorf("insert employee: %w", err)
	}
	return true, nil
}
