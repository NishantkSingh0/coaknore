package services

import (
	"context"
	"database/sql"
	"log"

	"github.com/google/uuid"
	"github.com/pms/backend/internal/models"
)

// RegisterJobHandlers registers all job handlers with the job queue
func RegisterJobHandlers(queue *JobQueue, taskSvc *TaskService, notifSvc *NotificationService, db *sql.DB) {
	// Overdue task notification job
	queue.RegisterHandler("overdue_task_notification", func(ctx context.Context, job *Job) error {
		return handleOverdueTaskNotification(ctx, job, taskSvc, notifSvc, db)
	})
}

// handleOverdueTaskNotification processes overdue task notification jobs
func handleOverdueTaskNotification(ctx context.Context, job *Job, taskSvc *TaskService, notifSvc *NotificationService, db *sql.DB) error {
	// Get overdue tasks
	tasks, err := taskSvc.GetOverdueTasks(uuid.Nil) // uuid.Nil = scan all orgs
	if err != nil {
		log.Printf("Error getting overdue tasks: %v", err)
		return err
	}

	for _, t := range tasks {
		var orgID uuid.UUID
		err := db.QueryRow(`SELECT organization_id FROM projects WHERE id = $1`, t.ProjectID).Scan(&orgID)
		if err != nil || orgID == uuid.Nil {
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

	log.Printf("Processed overdue task notification job: %d tasks notified", len(tasks))
	return nil
}

// ScheduleOverdueTaskCheck schedules the overdue task check job
func ScheduleOverdueTaskCheck(ctx context.Context, queue *JobQueue) error {
	// Schedule to run immediately (no delay)
	return queue.Enqueue(ctx, "overdue_task_notification", map[string]interface{}{}, 0)
}
