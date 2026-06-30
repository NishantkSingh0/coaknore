package logger

import (
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// Init configures zerolog for the environment.
func Init() {
	zerolog.TimeFieldFormat = time.RFC3339

	if os.Getenv("APP_ENV") == "development" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: "15:04:05"})
	} else {
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}
}

// Get returns the global logger.
func Get() *zerolog.Logger {
	return &log.Logger
}
