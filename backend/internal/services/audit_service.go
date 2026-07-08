package services

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/pms/backend/internal/models"
)

type AuditService struct {
	db *sql.DB
}

func NewAuditService(db *sql.DB) *AuditService {
	return &AuditService{db: db}
}

type AuditEntry struct {
	OrgID      uuid.UUID
	ProjectID  *uuid.UUID
	ActorID    *uuid.UUID
	ActorName  string
	Action     models.AuditAction
	EntityType string
	EntityID   *uuid.UUID
	EntityName string
	BeforeState interface{}
	AfterState  interface{}
	Metadata    interface{}
	IPAddress   string
}

func (s *AuditService) Log(e AuditEntry) {
	var beforeJSON, afterJSON, metaJSON []byte
	if e.BeforeState != nil {
		beforeJSON, _ = json.Marshal(e.BeforeState)
	}
	if e.AfterState != nil {
		afterJSON, _ = json.Marshal(e.AfterState)
	}
	if e.Metadata != nil {
		metaJSON, _ = json.Marshal(e.Metadata)
	}

	s.db.Exec(`
		INSERT INTO audit_logs (
			organization_id, project_id, actor_id, actor_name,
			action, entity_type, entity_id, entity_name,
			before_state, after_state, metadata, ip_address
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
	`,
		e.OrgID, e.ProjectID, e.ActorID, e.ActorName,
		e.Action, e.EntityType, e.EntityID, e.EntityName,
		nullBytes(beforeJSON), nullBytes(afterJSON), nullBytes(metaJSON),
		nullStr(e.IPAddress),
	)
}

func (s *AuditService) GetProjectTimeline(projectID uuid.UUID, page, pageSize int) ([]models.AuditLog, int, error) {
	var total int
	s.db.QueryRow(`SELECT COUNT(*) FROM audit_logs WHERE project_id = $1`, projectID).Scan(&total)

	rows, err := s.db.Query(`
		SELECT id, organization_id, project_id, actor_id, actor_name, action,
		       entity_type, entity_id, entity_name, before_state, after_state,
		       metadata, ip_address, created_at
		FROM audit_logs
		WHERE project_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, projectID, pageSize, (page-1)*pageSize)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []models.AuditLog
	for rows.Next() {
		var l models.AuditLog
		var projID, actorID, entityID sql.NullString
		var actorName, entityName, entityType, ipAddress sql.NullString
		var beforeState, afterState, metadata []byte

		rows.Scan(
			&l.ID, &l.OrganizationID, &projID, &actorID, &actorName, &l.Action,
			&entityType, &entityID, &entityName, &beforeState, &afterState,
			&metadata, &ipAddress, &l.CreatedAt,
		)

		if projID.Valid {
			id, _ := uuid.Parse(projID.String)
			l.ProjectID = &id
		}
		if actorID.Valid {
			id, _ := uuid.Parse(actorID.String)
			l.ActorID = &id
		}
		if actorName.Valid {
			l.ActorName = actorName.String
		}
		if entityType.Valid {
			l.EntityType = entityType.String
		}
		if entityID.Valid {
			id, _ := uuid.Parse(entityID.String)
			l.EntityID = &id
		}
		if entityName.Valid {
			l.EntityName = entityName.String
		}
		if ipAddress.Valid {
			l.IPAddress = ipAddress.String
		}
		if len(beforeState) > 0 {
			json.Unmarshal(beforeState, &l.BeforeState)
		}
		if len(afterState) > 0 {
			json.Unmarshal(afterState, &l.AfterState)
		}
		if len(metadata) > 0 {
			json.Unmarshal(metadata, &l.Metadata)
		}
		logs = append(logs, l)
	}
	return logs, total, nil
}

func (s *AuditService) GetAuditLogs(orgID uuid.UUID, entityType string, page, pageSize int) ([]models.AuditLog, int, error) {
	query := `SELECT COUNT(*) FROM audit_logs WHERE organization_id = $1`
	args := []interface{}{orgID}
	if entityType != "" {
		query += ` AND entity_type = $2`
		args = append(args, entityType)
	}
	var total int
	s.db.QueryRow(query, args...).Scan(&total)

	listQuery := fmt.Sprintf(`
		SELECT id, organization_id, project_id, actor_id, actor_name, action,
		       entity_type, entity_id, entity_name, created_at
		FROM audit_logs
		WHERE organization_id = $1 %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`,
		func() string {
			if entityType != "" {
				return "AND entity_type = $2"
			}
			return ""
		}(),
		len(args)+1, len(args)+2,
	)
	args = append(args, pageSize, (page-1)*pageSize)

	rows, err := s.db.Query(listQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []models.AuditLog
	for rows.Next() {
		var l models.AuditLog
		var projID, actorID, entityID sql.NullString
		var actorName, entityName sql.NullString

		rows.Scan(
			&l.ID, &l.OrganizationID, &projID, &actorID, &actorName, &l.Action,
			&l.EntityType, &entityID, &entityName, &l.CreatedAt,
		)
		if projID.Valid {
			id, _ := uuid.Parse(projID.String)
			l.ProjectID = &id
		}
		if actorID.Valid {
			id, _ := uuid.Parse(actorID.String)
			l.ActorID = &id
		}
		if actorName.Valid {
			l.ActorName = actorName.String
		}
		if entityID.Valid {
			id, _ := uuid.Parse(entityID.String)
			l.EntityID = &id
		}
		if entityName.Valid {
			l.EntityName = entityName.String
		}
		logs = append(logs, l)
	}
	return logs, total, nil
}
