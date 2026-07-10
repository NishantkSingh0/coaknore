package config

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestLoadReadsDotEnvFromBackendDirectory(t *testing.T) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("unable to resolve test file location")
	}

	projectDir := filepath.Clean(filepath.Join(filepath.Dir(filename), "..", ".."))
	originalWd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getting working directory: %v", err)
	}

	if err := os.Chdir(projectDir); err != nil {
		t.Fatalf("changing to project directory: %v", err)
	}
	defer func() {
		_ = os.Chdir(originalWd)
	}()

	for _, key := range []string{"DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "DB_SSLMODE"} {
		if _, had := os.LookupEnv(key); had {
			originalValue, _ := os.LookupEnv(key)
			_ = os.Unsetenv(key)
			defer func(k, old string, had bool) {
				if had {
					_ = os.Setenv(k, old)
				} else {
					_ = os.Unsetenv(k)
				}
			}(key, originalValue, true)
		} else {
			defer func(k string) {
				_ = os.Unsetenv(k)
			}(key)
		}
	}

	if err := os.Setenv("JWT_SECRET", "test-secret"); err != nil {
		t.Fatalf("setting JWT_SECRET: %v", err)
	}
	defer func() {
		_ = os.Unsetenv("JWT_SECRET")
	}()

	App = nil
	Load()

	if App == nil {
		t.Fatal("expected config to be initialized")
	}

	if App.DBUser != "nishantsingh" {
		t.Fatalf("expected DB user from .env, got %q", App.DBUser)
	}
	if App.DBPassword != "1234" {
		t.Fatalf("expected DB password from .env, got %q", App.DBPassword)
	}
	if App.DBName != "PMS4" {
		t.Fatalf("expected DB name from .env, got %q", App.DBName)
	}
}
