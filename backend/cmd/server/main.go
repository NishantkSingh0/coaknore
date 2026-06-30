package main

import (
	"fmt"
	"net/http"
	"os"

	"pms/backend/internal/auth"
	"pms/backend/internal/dashboard"
	"pms/backend/internal/database"
	"pms/backend/internal/departments"
	"pms/backend/internal/files"
	"pms/backend/internal/issues"
	"pms/backend/internal/middleware"
	"pms/backend/internal/notifications"
	"pms/backend/internal/projects"
	"pms/backend/internal/reports"
	"pms/backend/internal/tasks"
	"pms/backend/internal/users"
	"pms/backend/pkg/logger"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
	"github.com/rs/zerolog/log"
)

func main() {
	// Load .env (ignore error in production where env is set externally)
	_ = godotenv.Load()
	logger.Init()

	db, err := database.Connect()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer db.Close()
	log.Info().Msg("database connected")

	// Services & handlers
	notifSvc := notifications.NewService(db)
	projRepo := projects.NewRepository(db)

	deptHandler := departments.NewHandler(departments.NewRepository(db))

	// S3 is optional — gracefully degrade if not configured
	var s3Client *files.S3Client
	s3Client, s3Err := files.NewS3Client()
	if s3Err != nil {
		log.Warn().Err(s3Err).Msg("S3 not configured — file upload endpoints will return 503")
	} else {
		log.Info().Msg("S3 configured")
	}

	authHandler := auth.NewHandler(db, s3Client)
	userHandler := users.NewHandler(users.NewRepository(db), s3Client)
	projHandler := projects.NewHandler(projRepo, notifSvc, s3Client)
	taskHandler := tasks.NewHandler(db, notifSvc, projRepo)
	issueHandler := issues.NewHandler(db, notifSvc)
	reportHandler := reports.NewHandler(db, notifSvc, s3Client)
	notifHandler := notifications.NewHandler(db, notifSvc)
	dashHandler := dashboard.NewHandler(db, s3Client)

	var fileHandler *files.Handler
	if s3Client != nil {
		fileHandler = files.NewHandler(s3Client)
	}

	r := chi.NewRouter()

	// Global middleware
	r.Use(chimiddleware.Recoverer)
	r.Use(middleware.CORS)
	r.Use(middleware.RateLimit)
	r.Use(middleware.RequestLogger)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	r.Route("/api/v1", func(r chi.Router) {
		// --- Public auth routes ---
		r.Post("/auth/login", authHandler.Login)

		// --- Protected routes ---
		r.Group(func(r chi.Router) {
			r.Use(middleware.JWTAuth)

			r.Post("/auth/change-password", authHandler.ChangePassword)

			// Users — admin only for list/create/delete
			r.Route("/users", func(r chi.Router) {
				r.With(middleware.RequireRoles("admin")).Get("/", userHandler.List)
				r.With(middleware.RequireRoles("admin")).Post("/", userHandler.Create)
				r.Get("/{id}", userHandler.GetByID)
				r.Put("/{id}", userHandler.Update)
				r.With(middleware.RequireRoles("admin")).Put("/{id}/password", userHandler.ResetPassword)
				r.With(middleware.RequireRoles("admin")).Delete("/{id}", userHandler.Delete)
			})

			// Departments
			r.Route("/departments", func(r chi.Router) {
				r.Get("/", deptHandler.List)
				r.With(middleware.RequireRoles("admin")).Post("/", deptHandler.Create)
				r.With(middleware.RequireRoles("admin")).Put("/{id}", deptHandler.Update)
				r.With(middleware.RequireRoles("admin")).Delete("/{id}", deptHandler.Delete)
			})

			// Projects
			r.Route("/projects", func(r chi.Router) {
				r.Get("/", projHandler.List)
				r.With(middleware.RequireRoles("admin")).Post("/", projHandler.Create)
				r.Get("/{id}", projHandler.GetByID)
				r.With(middleware.RequireRoles("admin", "layer2")).Put("/{id}", projHandler.Update)
				r.With(middleware.RequireRoles("admin")).Delete("/{id}", projHandler.Delete)
				r.Get("/{id}/routing", projHandler.GetRouting)
				r.With(middleware.RequireRoles("admin", "layer2")).Post("/{id}/routing", projHandler.SetRouting)
			})

			// Tasks
			r.Route("/tasks", func(r chi.Router) {
				r.Get("/", taskHandler.List)
				r.Get("/{id}", taskHandler.GetByID)
				r.With(middleware.RequireRoles("layer3")).Put("/{id}", taskHandler.Update)
			})

			// Issues
			r.Route("/issues", func(r chi.Router) {
				r.Get("/", issueHandler.List)
				r.With(middleware.RequireRoles("layer3")).Post("/", issueHandler.Create)
				r.Get("/{id}", issueHandler.GetByID)
				r.With(middleware.RequireRoles("admin", "layer2")).Put("/{id}/approve", issueHandler.Approve)
				r.With(middleware.RequireRoles("admin", "layer2")).Put("/{id}/reject", issueHandler.Reject)
				r.With(middleware.RequireRoles("layer3")).Put("/{id}/close", issueHandler.Close)
				r.With(middleware.RequireRoles("layer3")).Post("/{id}/material-requisition", issueHandler.CreateMaterialRequisition)
				r.Get("/{id}/material-requisition", issueHandler.GetMaterialRequisition)
				r.With(middleware.RequireRoles("layer3")).Put("/{id}/rework-request", issueHandler.CreateReworkRequest)
			})

			// Reports
			r.Route("/reports", func(r chi.Router) {
				r.Get("/", reportHandler.List)
				r.With(middleware.RequireRoles("layer3")).Post("/", reportHandler.Create)
				r.Get("/{id}", reportHandler.GetByID)
			})

			// Files
			r.Route("/files", func(r chi.Router) {
				r.Post("/upload", func(w http.ResponseWriter, r *http.Request) {
					if fileHandler == nil {
						http.Error(w, `{"error":"S3 not configured"}`, http.StatusServiceUnavailable)
						return
					}
					fileHandler.Upload(w, r)
				})
				r.Get("/presigned", func(w http.ResponseWriter, r *http.Request) {
					if fileHandler == nil {
						http.Error(w, `{"error":"S3 not configured"}`, http.StatusServiceUnavailable)
						return
					}
					fileHandler.Presigned(w, r)
				})
			})

			// Notifications
			r.Route("/notifications", func(r chi.Router) {
				r.Get("/", notifHandler.List)
				r.Put("/read-all", notifHandler.MarkAllRead)
				r.Put("/{id}/read", notifHandler.MarkRead)
			})

			// Dashboard
			r.Route("/dashboard", func(r chi.Router) {
				r.With(middleware.RequireRoles("admin")).Get("/admin", dashHandler.AdminDashboard)
				r.With(middleware.RequireRoles("layer2")).Get("/layer2", dashHandler.Layer2Dashboard)
				r.With(middleware.RequireRoles("layer3")).Get("/layer3", dashHandler.Layer3Dashboard)
			})
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := fmt.Sprintf(":%s", port)
	log.Info().Str("addr", addr).Msg("server starting")
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal().Err(err).Msg("server failed")
	}
}
