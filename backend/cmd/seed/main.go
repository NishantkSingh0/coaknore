// This file is intentionally kept as a thin CLI wrapper around
// database.RunSeed so you can re-seed manually if needed.
//
// Usage:
//   cd backend && go run ./cmd/seed/main.go
//
// The seed logic lives in internal/database/seed.go.
// Edit database.DefaultSeed in that file to change the default credentials.

package main

import (
	"log"
	"os"
	"path/filepath"
	"runtime"

	"github.com/joho/godotenv"
	"github.com/pms/backend/internal/config"
	"github.com/pms/backend/internal/database"
)

func main() {
	// ── Load .env ────────────────────────────────────────────────────────────
	_, filename, _, _ := runtime.Caller(0)
	for _, candidate := range []string{
		filepath.Join(filepath.Dir(filename), "..", "..", ".env"),
		filepath.Join(filepath.Dir(filename), "..", "..", "..", ".env"),
		".env",
	} {
		if _, err := os.Stat(candidate); err == nil {
			if err := godotenv.Load(candidate); err != nil {
				log.Printf("godotenv: %v", err)
			}
			break
		}
	}

	config.Load()

	// ── Connect ───────────────────────────────────────────────────────────────
	db := database.Connect()
	defer db.Close()

	// ── Migrate ───────────────────────────────────────────────────────────────
	migsPath := filepath.Join(filepath.Dir(filename), "..", "..", "migrations")
	if _, err := database.RunMigrations(db, migsPath); err != nil {
		log.Fatalf("migration error: %v", err)
	}

	// ── Seed ──────────────────────────────────────────────────────────────────
	database.RunSeed(db)
}
