package services

import (
	"database/sql"
	"fmt"

	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/pms/backend/internal/models"
)

type NotificationService struct {
	db *sql.DB
}

func NewNotificationService(db *sql.DB) *NotificationService {
	return &NotificationService{db: db}
}

func (s *NotificationService) Send(orgID, recipientID uuid.UUID, notifType models.NotificationType,
	title, body string, projectID *uuid.UUID, entityType string, entityID *uuid.UUID) {

	s.db.Exec(`
		INSERT INTO notifications (organization_id, recipient_id, type, title, body, project_id, entity_type, entity_id)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
	`, orgID, recipientID, notifType, title, body, projectID, nullStr(entityType),
		func() interface{} {
			if entityID != nil {
				return *entityID
			}
			return nil
		}(),
	)
}

func (s *NotificationService) NotifyLayer(orgID uuid.UUID, layers []models.LayerType,
	notifType models.NotificationType, title, body string,
	projectID *uuid.UUID, entityType string, entityID *uuid.UUID) {

	layerStrs := make([]string, len(layers))
	for i, l := range layers {
		layerStrs[i] = string(l)
	}

	rows, err := s.db.Query(`
		SELECT id FROM employees WHERE organization_id = $1 AND layer = ANY($2) AND is_active = TRUE
	`, orgID, pq.Array(layerStrs))
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id uuid.UUID
		rows.Scan(&id)
		s.Send(orgID, id, notifType, title, body, projectID, entityType, entityID)
	}
}

func (s *NotificationService) NotifyDepartment(orgID, deptID uuid.UUID,
	notifType models.NotificationType, title, body string,
	projectID *uuid.UUID, entityType string, entityID *uuid.UUID) {

	rows, err := s.db.Query(`
		SELECT id FROM employees WHERE department_id = $1 AND is_active = TRUE
	`, deptID)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id uuid.UUID
		rows.Scan(&id)
		s.Send(orgID, id, notifType, title, body, projectID, entityType, entityID)
	}
}

func (s *NotificationService) NotifyOrg(orgID uuid.UUID,
	notifType models.NotificationType, title, body string,
	projectID *uuid.UUID, entityType string, entityID *uuid.UUID) {

	rows, err := s.db.Query(`
		SELECT id FROM employees WHERE organization_id = $1 AND is_active = TRUE
	`, orgID)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var id uuid.UUID
		rows.Scan(&id)
		s.Send(orgID, id, notifType, title, body, projectID, entityType, entityID)
	}
}

func (s *NotificationService) GetNotifications(employeeID uuid.UUID, unreadOnly bool, page, pageSize int) ([]models.Notification, int, error) {
	where := "WHERE recipient_id = $1"
	args := []interface{}{employeeID}
	argIdx := 2

	if unreadOnly {
		where += fmt.Sprintf(" AND is_read = $%d", argIdx)
		args = append(args, false)
		argIdx++
	}

	var total int
	s.db.QueryRow(`SELECT COUNT(*) FROM notifications `+where, args...).Scan(&total)

	listQuery := fmt.Sprintf(`
		SELECT n.id, n.organization_id, n.recipient_id, n.type, n.title, n.body,
		       n.project_id, n.entity_type, n.entity_id, n.is_read, n.created_at,
		       COALESCE(p.project_name, '') as project_name
		FROM notifications n
		LEFT JOIN projects p ON p.id = n.project_id
		%s
		ORDER BY n.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, pageSize, (page-1)*pageSize)

	rows, err := s.db.Query(listQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var notifs []models.Notification
	for rows.Next() {
		var n models.Notification
		var projID, entityID sql.NullString
		var body, entityType, projName sql.NullString

		rows.Scan(
			&n.ID, &n.OrganizationID, &n.RecipientID, &n.Type, &n.Title, &body,
			&projID, &entityType, &entityID, &n.IsRead, &n.CreatedAt, &projName,
		)
		if body.Valid {
			n.Body = body.String
		}
		if projID.Valid {
			id, _ := uuid.Parse(projID.String)
			n.ProjectID = &id
		}
		if entityType.Valid {
			n.EntityType = entityType.String
		}
		if entityID.Valid {
			id, _ := uuid.Parse(entityID.String)
			n.EntityID = &id
		}
		if projName.Valid {
			n.ProjectName = projName.String
		}
		notifs = append(notifs, n)
	}
	return notifs, total, nil
}

func (s *NotificationService) MarkRead(notifID, employeeID uuid.UUID) error {
	_, err := s.db.Exec(`
		UPDATE notifications SET is_read = TRUE WHERE id = $1 AND recipient_id = $2
	`, notifID, employeeID)
	return err
}

func (s *NotificationService) MarkAllRead(employeeID uuid.UUID) error {
	_, err := s.db.Exec(`
		UPDATE notifications SET is_read = TRUE WHERE recipient_id = $1 AND is_read = FALSE
	`, employeeID)
	return err
}

func (s *NotificationService) GetUnreadCount(employeeID uuid.UUID) int {
	var count int
	s.db.QueryRow(`SELECT COUNT(*) FROM notifications WHERE recipient_id = $1 AND is_read = FALSE`, employeeID).Scan(&count)
	return count
}

func (s *NotificationService) DeleteReadNotifications(employeeID uuid.UUID) error {
	_, err := s.db.Exec(`
		DELETE FROM notifications WHERE recipient_id = $1 AND is_read = TRUE
	`, employeeID)
	return err
}
