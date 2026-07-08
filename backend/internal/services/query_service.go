package services

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/pms/backend/internal/models"
)

type QueryService struct {
	db       *sql.DB
	auditSvc *AuditService
	notifSvc *NotificationService
}

func NewQueryService(db *sql.DB, audit *AuditService, notif *NotificationService) *QueryService {
	return &QueryService{db: db, auditSvc: audit, notifSvc: notif}
}

type CreateQueryRequest struct {
	ProjectID   string `json:"project_id"`
	RecipientID string `json:"recipient_id"`
	Subject     string `json:"subject"`
	Message     string `json:"message"`
}

func (s *QueryService) CreateQuery(orgID, senderID uuid.UUID, req CreateQueryRequest) (*models.Query, error) {
	if req.Subject == "" {
		return nil, errors.New("subject is required")
	}
	projectID, err := uuid.Parse(req.ProjectID)
	if err != nil {
		return nil, errors.New("invalid project_id")
	}
	recipientID, err := uuid.Parse(req.RecipientID)
	if err != nil {
		return nil, errors.New("invalid recipient_id")
	}
	if senderID == recipientID {
		return nil, errors.New("cannot send query to yourself")
	}

	// Validate adjacent layer rule
	var senderLayer, recipientLayer models.LayerType
	s.db.QueryRow(`SELECT layer FROM employees WHERE id = $1`, senderID).Scan(&senderLayer)
	s.db.QueryRow(`SELECT layer FROM employees WHERE id = $1`, recipientID).Scan(&recipientLayer)

	if !isAdjacentLayer(senderLayer, recipientLayer) {
		return nil, errors.New("communication only allowed between adjacent organizational layers")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	q := &models.Query{}
	err = tx.QueryRow(`
		INSERT INTO queries (project_id, subject, sender_id, recipient_id, status)
		VALUES ($1,$2,$3,$4,'open')
		RETURNING id, project_id, subject, sender_id, recipient_id, status,
		          sender_resolved, recipient_resolved, created_at, updated_at
	`, projectID, req.Subject, senderID, recipientID).Scan(
		&q.ID, &q.ProjectID, &q.Subject, &q.SenderID, &q.RecipientID, &q.Status,
		&q.SenderResolved, &q.RecipientResolved, &q.CreatedAt, &q.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create query: %w", err)
	}

	// Add initial message if provided
	if req.Message != "" {
		tx.Exec(`
			INSERT INTO query_messages (query_id, sender_id, message)
			VALUES ($1,$2,$3)
		`, q.ID, senderID, req.Message)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// Load sender/recipient names
	s.db.QueryRow(`SELECT CONCAT(first_name,' ',last_name), layer FROM employees WHERE id = $1`, senderID).Scan(&q.SenderName, &q.SenderLayer)
	s.db.QueryRow(`SELECT CONCAT(first_name,' ',last_name), layer FROM employees WHERE id = $1`, recipientID).Scan(&q.RecipientName, &q.RecipientLayer)

	s.auditSvc.Log(AuditEntry{
		OrgID: orgID, ProjectID: &projectID, ActorID: &senderID,
		Action: models.AuditCreated, EntityType: "query", EntityID: &q.ID,
		EntityName: req.Subject,
	})

	go s.notifSvc.Send(orgID, recipientID, models.NotifQueryReceived,
		"New Query",
		fmt.Sprintf("%s sent you a query: %s", q.SenderName, req.Subject),
		&projectID, "query", &q.ID)

	return q, nil
}

func (s *QueryService) SendMessage(orgID, queryID, senderID uuid.UUID, message string) (*models.QueryMessage, error) {
	q, err := s.GetQuery(queryID)
	if err != nil {
		return nil, err
	}
	if q.Status == models.QueryClosed {
		return nil, errors.New("query is closed")
	}
	if q.SenderID != senderID && q.RecipientID != senderID {
		return nil, errors.New("you are not a participant of this query")
	}

	msg := &models.QueryMessage{}
	var msgText sql.NullString
	err = s.db.QueryRow(`
		INSERT INTO query_messages (query_id, sender_id, message)
		VALUES ($1,$2,$3)
		RETURNING id, query_id, sender_id, message, created_at
	`, queryID, senderID, message).Scan(
		&msg.ID, &msg.QueryID, &msg.SenderID, &msgText, &msg.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to send message: %w", err)
	}
	if msgText.Valid {
		msg.Message = msgText.String
	}

	// Reset resolve flags on new message
	s.db.Exec(`
		UPDATE queries SET sender_resolved = FALSE, recipient_resolved = FALSE,
		       status = 'open', updated_at = NOW()
		WHERE id = $1
	`, queryID)

	// Load sender name
	s.db.QueryRow(`SELECT CONCAT(first_name,' ',last_name) FROM employees WHERE id = $1`, senderID).Scan(&msg.SenderName)

	// Notify the other party
	otherID := q.RecipientID
	if senderID == q.RecipientID {
		otherID = q.SenderID
	}

	var senderName string
	s.db.QueryRow(`SELECT CONCAT(first_name,' ',last_name) FROM employees WHERE id = $1`, senderID).Scan(&senderName)

	go s.notifSvc.Send(orgID, otherID, models.NotifQueryReplied,
		"Query Reply",
		fmt.Sprintf("%s replied to: %s", senderName, q.Subject),
		&q.ProjectID, "query", &queryID)

	return msg, nil
}

func (s *QueryService) MarkResolved(queryID, employeeID uuid.UUID) error {
	q, err := s.GetQuery(queryID)
	if err != nil {
		return err
	}
	if q.SenderID != employeeID && q.RecipientID != employeeID {
		return errors.New("you are not a participant of this query")
	}

	if employeeID == q.SenderID {
		s.db.Exec(`UPDATE queries SET sender_resolved = TRUE, updated_at = NOW() WHERE id = $1`, queryID)
	} else {
		s.db.Exec(`UPDATE queries SET recipient_resolved = TRUE, updated_at = NOW() WHERE id = $1`, queryID)
	}

	// Check if both resolved
	var senderResolved, recipientResolved bool
	s.db.QueryRow(`SELECT sender_resolved, recipient_resolved FROM queries WHERE id = $1`, queryID).
		Scan(&senderResolved, &recipientResolved)

	if senderResolved && recipientResolved {
		s.db.Exec(`UPDATE queries SET status = 'closed', updated_at = NOW() WHERE id = $1`, queryID)

		otherID := q.RecipientID
		if employeeID == q.RecipientID {
			otherID = q.SenderID
		}
		go s.notifSvc.Send(q.ProjectID, otherID, models.NotifQueryClosed,
			"Query Closed",
			fmt.Sprintf("Query '%s' has been closed by both parties", q.Subject),
			&q.ProjectID, "query", &queryID)
	} else if employeeID == q.SenderID {
		s.db.Exec(`UPDATE queries SET status = 'sender_resolved', updated_at = NOW() WHERE id = $1`, queryID)
	} else {
		s.db.Exec(`UPDATE queries SET status = 'recipient_resolved', updated_at = NOW() WHERE id = $1`, queryID)
	}

	return nil
}

func (s *QueryService) GetQuery(id uuid.UUID) (*models.Query, error) {
	q := &models.Query{}
	var senderName, recipientName, projName sql.NullString
	var senderLayer, recipientLayer sql.NullString

	err := s.db.QueryRow(`
		SELECT q.id, q.project_id, q.subject, q.sender_id, q.recipient_id, q.status,
		       q.sender_resolved, q.recipient_resolved, q.created_at, q.updated_at,
		       COALESCE(CONCAT(s.first_name,' ',s.last_name),'') as sender_name, s.layer as sender_layer,
		       COALESCE(CONCAT(r.first_name,' ',r.last_name),'') as recipient_name, r.layer as recipient_layer,
		       COALESCE(p.project_name,'') as project_name
		FROM queries q
		LEFT JOIN employees s ON s.id = q.sender_id
		LEFT JOIN employees r ON r.id = q.recipient_id
		LEFT JOIN projects p ON p.id = q.project_id
		WHERE q.id = $1
	`, id).Scan(
		&q.ID, &q.ProjectID, &q.Subject, &q.SenderID, &q.RecipientID, &q.Status,
		&q.SenderResolved, &q.RecipientResolved, &q.CreatedAt, &q.UpdatedAt,
		&senderName, &senderLayer, &recipientName, &recipientLayer, &projName,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("query not found")
	}
	if err != nil {
		return nil, err
	}

	if senderName.Valid {
		q.SenderName = senderName.String
	}
	if recipientName.Valid {
		q.RecipientName = recipientName.String
	}
	if senderLayer.Valid {
		q.SenderLayer = models.LayerType(senderLayer.String)
	}
	if recipientLayer.Valid {
		q.RecipientLayer = models.LayerType(recipientLayer.String)
	}
	if projName.Valid {
		q.ProjectName = projName.String
	}

	// Load messages
	q.Messages, _ = s.GetMessages(id)

	return q, nil
}

func (s *QueryService) GetMessages(queryID uuid.UUID) ([]models.QueryMessage, error) {
	rows, err := s.db.Query(`
		SELECT qm.id, qm.query_id, qm.sender_id, qm.message, qm.created_at,
		       COALESCE(CONCAT(e.first_name,' ',e.last_name),'') as sender_name
		FROM query_messages qm
		LEFT JOIN employees e ON e.id = qm.sender_id
		WHERE qm.query_id = $1
		ORDER BY qm.created_at ASC
	`, queryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []models.QueryMessage
	for rows.Next() {
		var m models.QueryMessage
		var msg sql.NullString
		rows.Scan(&m.ID, &m.QueryID, &m.SenderID, &msg, &m.CreatedAt, &m.SenderName)
		if msg.Valid {
			m.Message = msg.String
		}
		messages = append(messages, m)
	}
	return messages, nil
}

func (s *QueryService) ListQueries(employeeID uuid.UUID, projectID *uuid.UUID, status string, page, pageSize int) ([]models.Query, int, error) {
	conditions := []string{"(q.sender_id = $1 OR q.recipient_id = $1)"}
	args := []interface{}{employeeID}
	argIdx := 2

	if projectID != nil {
		conditions = append(conditions, fmt.Sprintf("q.project_id = $%d", argIdx))
		args = append(args, *projectID)
		argIdx++
	}
	if status != "" {
		conditions = append(conditions, fmt.Sprintf("q.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	where := "WHERE " + joinConditions(conditions, " AND ")
	var total int
	s.db.QueryRow(`SELECT COUNT(*) FROM queries q `+where, args...).Scan(&total)

	// Include last message preview and unread count in list
	query := fmt.Sprintf(`
		SELECT q.id, q.project_id, q.subject, q.sender_id, q.recipient_id, q.status,
		       q.sender_resolved, q.recipient_resolved, q.created_at, q.updated_at,
		       COALESCE(CONCAT(s.first_name,' ',s.last_name),'') as sender_name,
		       COALESCE(CONCAT(r.first_name,' ',r.last_name),'') as recipient_name,
		       COALESCE(p.project_name,'') as project_name,
		       s.layer as sender_layer, r.layer as recipient_layer,
		       lm.id as lm_id, lm.sender_id as lm_sender_id,
		       COALESCE(CONCAT(lme.first_name,' ',lme.last_name),'') as lm_sender_name,
		       lm.message as lm_message, lm.created_at as lm_created_at,
		       (SELECT COUNT(*) FROM query_messages qm2
		        WHERE qm2.query_id = q.id AND qm2.sender_id != $1) as unread_count
		FROM queries q
		LEFT JOIN employees s ON s.id = q.sender_id
		LEFT JOIN employees r ON r.id = q.recipient_id
		LEFT JOIN projects p ON p.id = q.project_id
		LEFT JOIN LATERAL (
			SELECT id, sender_id, message, created_at
			FROM query_messages
			WHERE query_id = q.id
			ORDER BY created_at DESC
			LIMIT 1
		) lm ON TRUE
		LEFT JOIN employees lme ON lme.id = lm.sender_id
		%s
		ORDER BY q.updated_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, pageSize, (page-1)*pageSize)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var queries []models.Query
	for rows.Next() {
		var q models.Query
		var senderName, recipientName, projName sql.NullString
		var senderLayer, recipientLayer sql.NullString
		var lmID, lmSenderID sql.NullString
		var lmSenderName, lmMessage sql.NullString
		var lmCreatedAt sql.NullTime
		var unreadCount int
		rows.Scan(
			&q.ID, &q.ProjectID, &q.Subject, &q.SenderID, &q.RecipientID, &q.Status,
			&q.SenderResolved, &q.RecipientResolved, &q.CreatedAt, &q.UpdatedAt,
			&senderName, &recipientName, &projName, &senderLayer, &recipientLayer,
			&lmID, &lmSenderID, &lmSenderName, &lmMessage, &lmCreatedAt,
			&unreadCount,
		)
		if senderName.Valid {
			q.SenderName = senderName.String
		}
		if recipientName.Valid {
			q.RecipientName = recipientName.String
		}
		if projName.Valid {
			q.ProjectName = projName.String
		}
		if senderLayer.Valid {
			q.SenderLayer = models.LayerType(senderLayer.String)
		}
		if recipientLayer.Valid {
			q.RecipientLayer = models.LayerType(recipientLayer.String)
		}
		// Populate last message preview
		if lmID.Valid {
			lm := &models.QueryMessage{}
			if id, err := uuid.Parse(lmID.String); err == nil {
				lm.ID = id
			}
			if id, err := uuid.Parse(lmSenderID.String); err == nil {
				lm.SenderID = id
			}
			lm.QueryID = q.ID
			if lmSenderName.Valid {
				lm.SenderName = lmSenderName.String
			}
			if lmMessage.Valid {
				lm.Message = lmMessage.String
			}
			if lmCreatedAt.Valid {
				lm.CreatedAt = lmCreatedAt.Time
			}
			q.LastMessage = lm
		}
		q.UnreadCount = unreadCount
		queries = append(queries, q)
	}
	return queries, total, nil
}

func isAdjacentLayer(a, b models.LayerType) bool {
	adj := map[models.LayerType][]models.LayerType{
		models.LayerThree: {models.LayerTwo},
		models.LayerTwo:   {models.LayerOne, models.LayerSuperAdmin, models.LayerThree},
		models.LayerOne:   {models.LayerTwo},
		models.LayerSuperAdmin: {models.LayerTwo},
	}
	for _, l := range adj[a] {
		if l == b {
			return true
		}
	}
	return false
}
