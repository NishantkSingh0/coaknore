package config

import (
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv      string
	AppPort     string
	FrontendURL string

	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	JWTSecret       string
	JWTExpiryHours  int

	AWSRegion          string
	AWSAccessKeyID     string
	AWSSecretAccessKey string
	AWSS3Bucket        string
	AWSS3Endpoint      string

	CORSAllowedOrigins string
	MaxUploadSizeMB    int64

	PasswordResetExpiryHours int

	GeminiAPIKey string

	GroqAPIKey1 string
	GroqAPIKey2 string
	GroqAPIKey3 string
	GroqAPIKey4 string
	GroqAPIKey5 string
}

var App *Config

func Load() {
	loadedEnv := false
	if err := godotenv.Load("../.env"); err == nil {
		loadedEnv = true
	}
	if err := godotenv.Overload(".env"); err == nil {
		loadedEnv = true
	}
	if !loadedEnv {
		log.Println("No .env file found, reading from environment")
	}

	jwtExpiry, _ := strconv.Atoi(getEnv("JWT_EXPIRY_HOURS", "24"))
	maxUpload, _ := strconv.ParseInt(getEnv("MAX_UPLOAD_SIZE_MB", "50"), 10, 64)
	pwResetExpiry, _ := strconv.Atoi(getEnv("PASSWORD_RESET_EXPIRY_HOURS", "2"))

	App = &Config{
		AppEnv:      getEnv("APP_ENV", "development"),
		AppPort:     getEnv("APP_PORT", "8080"),
		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:5173"),

		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "pms_user"),
		DBPassword: getEnv("DB_PASSWORD", ""),
		DBName:     getEnv("DB_NAME", "pms_db"),
		DBSSLMode:  getEnv("DB_SSLMODE", "disable"),

		JWTSecret:      getEnv("JWT_SECRET", ""),
		JWTExpiryHours: jwtExpiry,

		AWSRegion:          getEnv("AWS_REGION", "us-east-1"),
		AWSAccessKeyID:     getEnv("AWS_ACCESS_KEY_ID", ""),
		AWSSecretAccessKey: getEnv("AWS_SECRET_ACCESS_KEY", ""),
		AWSS3Bucket:        getEnv("AWS_S3_BUCKET", ""),
		AWSS3Endpoint:      getEnv("AWS_S3_ENDPOINT", ""),

		CORSAllowedOrigins: getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173"),
		MaxUploadSizeMB:    maxUpload,

		PasswordResetExpiryHours: pwResetExpiry,

		GeminiAPIKey: getEnv("GEMINI_API_KEY", ""),

		GroqAPIKey1: getEnv("GROQ_API_KEY1", ""),
		GroqAPIKey2: getEnv("GROQ_API_KEY2", ""),
		GroqAPIKey3: getEnv("GROQ_API_KEY3", ""),
		GroqAPIKey4: getEnv("GROQ_API_KEY4", ""),
		GroqAPIKey5: getEnv("GROQ_API_KEY5", ""),
	}

	if App.JWTSecret == "" {
		log.Fatal("JWT_SECRET must be set in environment")
	}

	// Warn if AWS credentials are not configured (file uploads will fail)
	if App.AWSAccessKeyID == "" || App.AWSSecretAccessKey == "" || App.AWSS3Bucket == "" {
		log.Println("WARNING: AWS S3 credentials not configured. File uploads will fail.")
		log.Println("Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET in .env")
	}
}

func (c *Config) DBConnectionString() string {
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.DBHost, c.DBPort, c.DBUser, c.DBPassword, c.DBName, c.DBSSLMode)
}

func (c *Config) DBConnectionURL() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
		c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName, c.DBSSLMode)
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}