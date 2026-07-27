package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"github.com/pms/backend/internal/config"
	"github.com/pms/backend/internal/database"
	"github.com/pms/backend/internal/handlers"
	appmiddleware "github.com/pms/backend/internal/middleware"
	"github.com/pms/backend/internal/models"
	"github.com/pms/backend/internal/services"
)

func main() {
	// Load config
	config.Load()
	cfg := config.App
	port := os.Getenv("PORT")
	if port == "" {
		port = cfg.AppPort
		if port == "" {
			port = "8080"
		}
	}

	log.Printf("Starting PMS backend [%s] on port %s", cfg.AppEnv, port)
	// Connect to DB
	db := database.Connect()
	defer db.Close()

	// ── Migrations + Seed ───────────────────────────────────────────────────
	// Resolve the migrations directory relative to the running binary so this
	// works both with `go run` and a compiled binary.
	_, filename, _, _ := runtime.Caller(0)
	migrationsPath := filepath.Join(filepath.Dir(filename), "..", "migrations")

	newMigrations, err := database.RunMigrations(db, migrationsPath)
	if err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	// Seed runs:
	//   • always when this is a fresh install (new migrations were applied), OR
	//   • always unconditionally — RunSeed is fully idempotent, so it is safe
	//     to call every startup; it only writes when the org/admin don't exist.
	database.RunSeed(db)
	_ = newMigrations // kept so the variable is used; used above for clarity

	// ── Services ────────────────────────────────────────────────────────────
	auditSvc := services.NewAuditService(db)
	notifSvc := services.NewNotificationService(db)
	orgSvc := services.NewOrganizationService(db)
	authSvc := services.NewAuthService(db)

	var fileSvc *services.FileService
	fileSvc, err = services.NewFileService(db)
	if err != nil {
		log.Printf("WARNING: S3 file service unavailable (%v) — uploads will fail", err)
	}

	projectSvc := services.NewProjectService(db, auditSvc, notifSvc, fileSvc)
	routingSvc := services.NewRoutingService(db, auditSvc, notifSvc)
	taskSvc := services.NewTaskService(db, auditSvc, notifSvc, routingSvc)
	routingSvc.SetTaskService(taskSvc)
	matSvc := services.NewMaterialService(db, auditSvc, notifSvc)
	reworkSvc := services.NewReworkService(db, auditSvc, notifSvc, routingSvc)
	issueSvc := services.NewIssueService(db, auditSvc, notifSvc)
	querySvc := services.NewQueryService(db, auditSvc, notifSvc)
	reportSvc := services.NewDailyReportService(db, auditSvc, notifSvc)
	searchSvc := services.NewSearchService(db)
	aiSvc := services.NewAIService(db)

	// ── Handlers ────────────────────────────────────────────────────────────
	authHandler := handlers.NewAuthHandler(authSvc, orgSvc, fileSvc)
	orgHandler := handlers.NewOrganizationHandler(orgSvc, authSvc)
	projectHandler := handlers.NewProjectHandler(projectSvc, auditSvc, fileSvc)
	routingHandler := handlers.NewRoutingHandler(routingSvc)
	taskHandler := handlers.NewTaskHandler(taskSvc, fileSvc)
	issueHandler := handlers.NewIssueHandler(issueSvc, fileSvc)
	reworkHandler := handlers.NewReworkHandler(reworkSvc, fileSvc)
	queryHandler := handlers.NewQueryHandler(querySvc, fileSvc)
	reportHandler := handlers.NewReportHandler(reportSvc, fileSvc)
	matHandler := handlers.NewMaterialHandler(matSvc, fileSvc)
	notifHandler := handlers.NewNotificationHandler(notifSvc)
	searchHandler := handlers.NewSearchHandler(searchSvc)
	aiHandler := handlers.NewAIHandler(aiSvc)

	// ── Router ──────────────────────────────────────────────────────────────
	r := chi.NewRouter()

	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(appmiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Timeout(60 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSAllowedOriginsSlice(),
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Requested-With"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// ── Public routes ────────────────────────────────────────────────────────
	r.Group(func(r chi.Router) {
		r.Post("/api/auth/login", authHandler.Login)
		r.Post("/api/auth/forgot-password", authHandler.ForgotPassword)
		r.Post("/api/auth/reset-password", authHandler.ResetPassword)
		r.Get("/api/public/avatar", authHandler.GetAvatarProxy)
		r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintln(w, `{"status":"ok"}`)
		})
	})

	// ── Authenticated routes ─────────────────────────────────────────────────
	r.Group(func(r chi.Router) {
		r.Use(appmiddleware.AuthMiddleware)
		// Validates that the employee from the token still exists and is active.
		// This prevents FK errors when a DB is reset but the browser has a stale token.
		r.Use(appmiddleware.ValidateEmployee(db))

		// Auth
		r.Get("/api/auth/me", authHandler.Me)
		r.Post("/api/auth/change-password", authHandler.ChangePassword)
		r.Post("/api/auth/me/avatar", authHandler.UpdateAvatar)
		r.Delete("/api/auth/me/avatar", authHandler.RemoveAvatar)

		// Notifications (all layers)
		r.Get("/api/notifications", notifHandler.GetNotifications)
		r.Get("/api/notifications/count", notifHandler.GetUnreadCount)
		r.Patch("/api/notifications/{id}/read", notifHandler.MarkRead)
		r.Post("/api/notifications/read-all", notifHandler.MarkAllRead)
		r.Delete("/api/notifications/read", notifHandler.DeleteReadNotifications)

		// Search (all layers)
		r.Get("/api/search", searchHandler.Search)

		// Organization read (all layers)
		r.Get("/api/organization", orgHandler.GetOrganization)
		r.Get("/api/departments", orgHandler.ListDepartments)
		r.Get("/api/departments/{id}", orgHandler.GetDepartment)
		r.Get("/api/employees/search", orgHandler.SearchEmployees)

		// ── Admin only ────────────────────────────────────────────────────────
		r.Group(func(r chi.Router) {
			r.Use(appmiddleware.RequireLayer(models.LayerOne, models.LayerSuperAdmin))

			// Org management
			r.Post("/api/departments", orgHandler.CreateDepartment)
			r.Put("/api/departments/{id}", orgHandler.UpdateDepartment)
			r.Patch("/api/departments/{id}/toggle", orgHandler.ToggleDepartment)

			r.Get("/api/employees", orgHandler.ListEmployees)
			r.Get("/api/employees/{id}", orgHandler.GetEmployee)
			r.Post("/api/employees", orgHandler.CreateEmployee)
			r.Put("/api/employees/{id}", orgHandler.UpdateEmployee)
			r.Patch("/api/employees/{id}/toggle", orgHandler.ToggleEmployee)
			r.Post("/api/employees/{id}/transfer", orgHandler.TransferEmployee)
			r.Post("/api/employees/{id}/reset-password", orgHandler.AdminResetPassword)

			// Project CRUD
			r.Post("/api/projects", projectHandler.CreateProject)
			r.Put("/api/projects/{id}", projectHandler.UpdateProject)
			r.Patch("/api/projects/{id}/status", projectHandler.UpdateProjectStatus)
			r.Post("/api/projects/{id}/drawing", projectHandler.UploadDrawing)

			// Dashboard stats
			r.Get("/api/dashboard/stats", searchHandler.GetDashboardStats)

			// AI Assistant
			r.Post("/api/ai/chat", aiHandler.Chat)
		})

		// Projects — read (all layers)
		r.Get("/api/projects", projectHandler.ListProjects)
		r.Get("/api/projects/{id}", projectHandler.GetProject)
		r.Get("/api/projects/{id}/restricted", projectHandler.GetProjectRestricted)
		r.Get("/api/projects/{id}/revisions", projectHandler.GetRevisions)
		r.Get("/api/projects/{id}/timeline", projectHandler.GetTimeline)

		// ── Layer 2 + Admin ───────────────────────────────────────────────────
		r.Group(func(r chi.Router) {
			r.Use(appmiddleware.RequireLayer(models.LayerTwo, models.LayerOne, models.LayerSuperAdmin))

			// Department task file upload
			r.Post("/api/tasks/{id}/department-file", taskHandler.UploadDepartmentTaskFile)

			// Routing builder
			r.Post("/api/projects/{projectId}/routings", routingHandler.CreateRouting)
			r.Put("/api/routings/{id}", routingHandler.UpdateRouting)
			r.Post("/api/routings/{id}/new-version", routingHandler.CreateNewRoutingVersion)
			r.Post("/api/routings/{id}/publish", routingHandler.PublishRouting)
			r.Get("/api/routing-templates", routingHandler.GetTemplates)

			// Approvals
			r.Post("/api/issues/{id}/review", issueHandler.ReviewIssue)
			r.Post("/api/reworks/{id}/approve", reworkHandler.ApproveRework)
			r.Post("/api/reworks/{id}/reject", reworkHandler.RejectRework)
			r.Post("/api/materials/{id}/review", matHandler.ReviewRequisition)
		})

		// Routings — read
		r.Get("/api/projects/{projectId}/routings", routingHandler.ListProjectRoutings)
		r.Get("/api/routings/{id}", routingHandler.GetRouting)
		r.Get("/api/routings/{id}/timeline", routingHandler.GetEditTimeline)

		// Tasks — read + write
		r.Get("/api/projects/{projectId}/tasks", taskHandler.GetProjectTasks)
		r.Get("/api/tasks/{id}", taskHandler.GetTask)
		r.Get("/api/my-tasks", taskHandler.GetDepartmentTasks)
		r.Get("/api/departments/{departmentId}/upcoming-tasks", routingHandler.GetUpcomingTasks)

		r.Group(func(r chi.Router) {
			r.Use(appmiddleware.RequireLayer(
				models.LayerTwo, models.LayerThree,
				models.LayerOne, models.LayerSuperAdmin,
			))
			r.Patch("/api/tasks/{id}/status", taskHandler.UpdateTaskStatus)
			r.Post("/api/tasks/{id}/assign-employees", taskHandler.AssignEmployees)
			r.Patch("/api/tasks/{id}/dates", taskHandler.SetTaskDates)
			r.Patch("/api/tasks/{id}/expected-completion", taskHandler.SetExpectedCompletionDate)

			// Subtasks
			r.Post("/api/tasks/{taskId}/subtasks", taskHandler.CreateSubtask)
			r.Patch("/api/subtasks/{id}/complete", taskHandler.CompleteSubtask)
			r.Put("/api/subtasks/{id}", taskHandler.UpdateSubtask)
			r.Post("/api/subtasks/{id}/proof", taskHandler.UploadSubtaskProof)
		})

		// Issues
		r.Get("/api/issues", issueHandler.ListIssues)
		r.Get("/api/issues/{id}", issueHandler.GetIssue)
		r.Post("/api/projects/{projectId}/issues", issueHandler.RaiseIssue)
		r.Post("/api/issues/{id}/resolve", issueHandler.ResolveIssue)
		r.Post("/api/issues/{id}/files", issueHandler.UploadIssueFile)

		// Reworks
		r.Get("/api/reworks", reworkHandler.ListReworks)
		r.Get("/api/reworks/{id}", reworkHandler.GetRework)
		r.Post("/api/projects/{projectId}/reworks", reworkHandler.RequestRework)

		// Queries
		r.Get("/api/queries", queryHandler.ListQueries)
		r.Post("/api/queries", queryHandler.CreateQuery)
		r.Get("/api/queries/{id}", queryHandler.GetQuery)
		r.Post("/api/queries/{id}/messages", queryHandler.SendMessage)
		r.Post("/api/queries/{id}/files", queryHandler.UploadQueryFile)
		r.Post("/api/queries/{id}/resolve", queryHandler.MarkResolved)

		// Daily Reports
		r.Get("/api/reports", reportHandler.ListReports)
		r.Post("/api/reports", reportHandler.CreateReport)
		r.Get("/api/reports/{id}", reportHandler.GetReport)
		r.Post("/api/reports/{id}/files", reportHandler.UploadReportFile)

		// Materials
		r.Get("/api/materials", matHandler.ListRequisitions)
		r.Post("/api/materials", matHandler.CreateRequisition)
		r.Get("/api/materials/{id}", matHandler.GetRequisition)
	})

	// ── Background jobs ──────────────────────────────────────────────────────
	// Overdue task notifier — runs every hour
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			tasks, err := taskSvc.GetOverdueTasks(uuid.Nil) // uuid.Nil = scan all orgs
			if err != nil {
				continue
			}
			for _, t := range tasks {
				var orgID uuid.UUID
				db.QueryRow(`SELECT organization_id FROM projects WHERE id = $1`, t.ProjectID).Scan(&orgID)
				if orgID == uuid.Nil {
					continue
				}
				notifSvc.NotifyLayer(orgID,
					[]models.LayerType{models.LayerTwo, models.LayerOne, models.LayerSuperAdmin},
					models.NotifOverdueTask,
					"Overdue Task",
					t.DepartmentName+" task is past its due date",
					&t.ProjectID, "task", &t.ID,
				)
			}
		}
	}()

	// ── Server ───────────────────────────────────────────────────────────────
	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("Server listening on :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	<-done
	log.Print("Server stopping...")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server shutdown failed: %v", err)
	}

	log.Print("Server stopped")
}
