package database

import (
	"database/sql"
	"fmt"
	"log"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"

	_ "github.com/lib/pq"
	"github.com/pms/backend/internal/config"
)

var DB *sql.DB

func Connect() *sql.DB {
	cfg := config.App
	connStr := buildConnectionString(cfg)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to open database connection: %v", err)
	}
	if err := db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)

	log.Println("Database connected successfully")
	DB = db
	return db
}

func buildConnectionString(cfg *config.Config) string {
	if cfg.DatabaseURL != "" {
		return withURLConnectTimeout(cfg.DatabaseURL, "10")
	}

	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s connect_timeout=10",
		cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBSSLMode,
	)
}

func withURLConnectTimeout(connURL string, seconds string) string {
	u, err := url.Parse(connURL)
	if err != nil {
		return connURL
	}
	q := u.Query()
	if q.Get("connect_timeout") == "" {
		q.Set("connect_timeout", seconds)
	}
	u.RawQuery = q.Encode()
	return u.String()
}

// RunMigrations applies any pending *.sql files from migrationsPath in
// lexicographic order. It returns the number of newly-applied migrations.
// It is idempotent — already-applied files are skipped.
func RunMigrations(db *sql.DB, migrationsPath string) (int, error) {
	// Ensure tracking table exists.
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			id         SERIAL       PRIMARY KEY,
			filename   VARCHAR(255) NOT NULL UNIQUE,
			applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
		)
	`)
	if err != nil {
		return 0, fmt.Errorf("create migrations table: %w", err)
	}

	files, err := filepath.Glob(filepath.Join(migrationsPath, "*.sql"))
	if err != nil {
		return 0, fmt.Errorf("list migration files: %w", err)
	}
	sort.Strings(files)

	applied := 0
	for _, f := range files {
		filename := filepath.Base(f)

		var count int
		if err := db.QueryRow(
			`SELECT COUNT(*) FROM schema_migrations WHERE filename = $1`, filename,
		).Scan(&count); err != nil {
			return applied, fmt.Errorf("check migration %s: %w", filename, err)
		}
		if count > 0 {
			log.Printf("[migrate] already applied: %s", filename)
			continue
		}

		content, err := os.ReadFile(f)
		if err != nil {
			return applied, fmt.Errorf("read migration %s: %w", filename, err)
		}

		tx, err := db.Begin()
		if err != nil {
			return applied, fmt.Errorf("begin tx for %s: %w", filename, err)
		}

		if _, err := tx.Exec(string(content)); err != nil {
			tx.Rollback()
			return applied, fmt.Errorf("execute migration %s: %w", filename, err)
		}

		if _, err := tx.Exec(
			`INSERT INTO schema_migrations (filename) VALUES ($1)`, filename,
		); err != nil {
			tx.Rollback()
			return applied, fmt.Errorf("record migration %s: %w", filename, err)
		}

		if err := tx.Commit(); err != nil {
			return applied, fmt.Errorf("commit migration %s: %w", filename, err)
		}

		log.Printf("[migrate] applied: %s", filename)
		applied++
	}

	if applied == 0 {
		log.Println("[migrate] all migrations already applied")
	} else {
		log.Printf("[migrate] %d new migration(s) applied", applied)
	}
	return applied, nil
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func NullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}

func NullStringVal(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}

func StringPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func StringPtrVal(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func BuildWhereClause(conditions []string, args []interface{}) (string, []interface{}) {
	if len(conditions) == 0 {
		return "", args
	}
	return "WHERE " + strings.Join(conditions, " AND "), args
}
