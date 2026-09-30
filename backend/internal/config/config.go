package config

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv      string
	AppPort     string
	FrontendURL string

	DBHost      string
	DBPort      string
	DBUser      string
	DBPassword  string
	DBName      string
	DBSSLMode   string
	DatabaseURL string

	JWTSecret      string
	JWTExpiryHours int

	R2AccountID      string
	R2AccessKeyID    string
	R2SecretAccessKey string
	R2BucketName     string
	R2Endpoint       string

	CORSAllowedOrigins string
	MaxUploadSizeMB    int64

	// Compression settings
	EnableCompression     bool
	MaxImageWidth         int
	MaxImageHeight        int
	ImageQuality          int

	PasswordResetExpiryHours int

	GeminiAPIKey string

	RedisURL string

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

	enableCompression := getEnv("ENABLE_COMPRESSION", "true") == "true"
	maxImageWidth, _ := strconv.Atoi(getEnv("MAX_IMAGE_WIDTH", "1920"))
	maxImageHeight, _ := strconv.Atoi(getEnv("MAX_IMAGE_HEIGHT", "1080"))
	imageQuality, _ := strconv.Atoi(getEnv("IMAGE_QUALITY", "85"))

	App = &Config{
		AppEnv:             getEnv("APP_ENV", "development"),
		AppPort:            getEnv("APP_PORT", "8080"),
		FrontendURL:        getEnv("FRONTEND_URL", "http://localhost:5173"),
		CORSAllowedOrigins: getEnv("CORS_ALLOWED_ORIGINS", getEnv("FRONTEND_URL", "http://localhost:5173")),

		DBHost:      getEnv("DB_HOST", "localhost"),
		DBPort:      getEnv("DB_PORT", "5432"),
		DBUser:      getEnv("DB_USER", "pms_user"),
		DBPassword:  getEnv("DB_PASSWORD", ""),
		DBName:      getEnv("DB_NAME", "pms_db"),
		DBSSLMode:   getEnv("DB_SSLMODE", "disable"),
		DatabaseURL: getEnv("DATABASE_URL", ""),

		JWTSecret:      getEnv("JWT_SECRET", ""),
		JWTExpiryHours: jwtExpiry,

		R2AccountID:      getEnv("R2_ACCOUNT_ID", ""),
		R2AccessKeyID:    getEnv("R2_ACCESS_KEY_ID", ""),
		R2SecretAccessKey: getEnv("R2_SECRET_ACCESS_KEY", ""),
		R2BucketName:     getEnv("R2_BUCKET_NAME", ""),
		R2Endpoint:       getEnv("R2_ENDPOINT", ""),

		MaxUploadSizeMB: maxUpload,

		EnableCompression:  enableCompression,
		MaxImageWidth:     maxImageWidth,
		MaxImageHeight:    maxImageHeight,
		ImageQuality:      imageQuality,

		PasswordResetExpiryHours: pwResetExpiry,

		GeminiAPIKey: getEnv("GEMINI_API_KEY", ""),

		RedisURL: getEnv("REDIS_URL", "redis://localhost:6379"),

		GroqAPIKey1: getEnv("GROQ_API_KEY1", ""),
		GroqAPIKey2: getEnv("GROQ_API_KEY2", ""),
		GroqAPIKey3: getEnv("GROQ_API_KEY3", ""),
		GroqAPIKey4: getEnv("GROQ_API_KEY4", ""),
		GroqAPIKey5: getEnv("GROQ_API_KEY5", ""),
	}

	if App.JWTSecret == "" {
		log.Fatal("JWT_SECRET must be set in environment")
	}

	// Warn if R2 credentials are not configured (file uploads will fail)
	if App.R2AccessKeyID == "" || App.R2SecretAccessKey == "" || App.R2BucketName == "" {
		log.Println("WARNING: Cloudflare R2 credentials not configured. File uploads will fail.")
		log.Println("Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in .env")
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

func (c *Config) CORSAllowedOriginsSlice() []string {
	if c.CORSAllowedOrigins == "" {
		return nil
	}

	rawOrigins := strings.Split(c.CORSAllowedOrigins, ",")
	origins := make([]string, 0, len(rawOrigins))
	for _, origin := range rawOrigins {
		origin = strings.TrimRight(strings.TrimSpace(origin), "/")
		if origin != "" {
			origins = append(origins, origin)
		}
	}
	return origins
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
