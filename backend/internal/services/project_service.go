package services

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/pms/backend/internal/models"
)

type ProjectService struct {
	db       *sql.DB
	auditSvc *AuditService
	notifSvc *NotificationService
	fileSvc  *FileService
}

func NewProjectService(db *sql.DB, audit *AuditService, notif *NotificationService, fileSvc *FileService) *ProjectService {
	return &ProjectService{db: db, auditSvc: audit, notifSvc: notif, fileSvc: fileSvc}
}

type CreateProjectRequest struct {
	PONumber          string  `json:"po_number"`
	ProjectName       string  `json:"project_name"`
	ClientName        string  `json:"client_name"`
	ClientEmail       string  `json:"client_email"`
	ClientPhone       string  `json:"client_phone"`
	ClientAddress     string  `json:"client_address"`
	ClientGSTNum      string  `json:"client_gst_num"`
	Rate              float64 `json:"rate"`
	Quantity          int    `json:"quantity"`
	Specifications    string `json:"specifications"`
	MaterialDetails   string `json:"material_details"`
	UpholsteryDetails string `json:"upholstery_details"`
	DeliveryDate      string `json:"delivery_date"`
	DeliveryAddress   string `json:"delivery_address"`
	CoverImageURL     string `json:"cover_image_url"`
	CADFilesURL       string `json:"cad_files_url"`
	JobCardsURL       string `json:"job_cards_url"`
	RenderFilesURL    string `json:"render_files_url"`
	DrawingFileID     string `json:"drawing_file_id"`
}

func (s *ProjectService) CreateProject(orgID, createdBy uuid.UUID, req CreateProjectRequest) (*models.Project, error) {
	var deliveryDate interface{}
	if req.DeliveryDate != "" {
		t, err := time.Parse("2006-01-02", req.DeliveryDate)
		if err != nil {
			return nil, errors.New("invalid delivery_date format, use YYYY-MM-DD")
		}
		deliveryDate = t
	}

	if req.Quantity < 1 {
		req.Quantity = 1
	}

	var drawingFileID interface{}
	if req.DrawingFileID != "" {
		id, err := uuid.Parse(req.DrawingFileID)
		if err != nil {
			return nil, errors.New("invalid drawing_file_id")
		}
		drawingFileID = id
	}

	p := &models.Project{}
	var (
		clientEmail, clientPhone, clientAddr, clientGSTNum sql.NullString
		deliveryAddr                         sql.NullString
		coverImg, cadURL                     sql.NullString
		jobCards, renderURL                  sql.NullString
		delivDate                            sql.NullTime
		drawFileID                           sql.NullString
		rate                                 sql.NullFloat64
	)

	err := s.db.QueryRow(`
		INSERT INTO projects (
			organization_id, po_number, project_name, client_name,
			client_email, client_phone, client_address, client_gst_num, rate, quantity,
			specifications, material_details, upholstery_details,
			delivery_date, delivery_address, cover_image_url, cad_files_url,
			job_cards_url, render_files_url, drawing_file_id, status, created_by
		) VALUES (
			$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'created',$21
		)
		RETURNING id, organization_id, po_number, project_name, client_name,
			client_email, client_phone, client_address, client_gst_num, rate, quantity,
			specifications, material_details, upholstery_details,
			delivery_date, delivery_address,
			cover_image_url, cad_files_url, job_cards_url, render_files_url,
			drawing_file_id, status, created_by, current_revision, created_at, updated_at
	`,
		orgID, req.PONumber, req.ProjectName, req.ClientName,
		nullStr(req.ClientEmail), nullStr(req.ClientPhone), nullStr(req.ClientAddress), nullStr(req.ClientGSTNum), nullFloat64(req.Rate), req.Quantity,
		req.Specifications, req.MaterialDetails, req.UpholsteryDetails,
		deliveryDate, nullStr(req.DeliveryAddress),
		nullStr(req.CoverImageURL), nullStr(req.CADFilesURL),
		nullStr(req.JobCardsURL), nullStr(req.RenderFilesURL),
		drawingFileID, createdBy,
	).Scan(
		&p.ID, &p.OrganizationID, &p.PONumber, &p.ProjectName, &p.ClientName,
		&clientEmail, &clientPhone, &clientAddr, &clientGSTNum, &rate, &p.Quantity,
		&p.Specifications, &p.MaterialDetails, &p.UpholsteryDetails,
		&delivDate, &deliveryAddr,
		&coverImg, &cadURL, &jobCards, &renderURL,
		&drawFileID, &p.Status, &p.CreatedBy, &p.CurrentRevision, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create project: %w", err)
	}

	scanNullableProjectFields(p, clientEmail, clientPhone, clientAddr, clientGSTNum, rate,
		delivDate, deliveryAddr, coverImg, cadURL, jobCards, renderURL, drawFileID)

	s.auditSvc.Log(AuditEntry{
		OrgID: orgID, ProjectID: &p.ID, ActorID: &createdBy,
		Action: models.AuditCreated, EntityType: "project", EntityID: &p.ID, EntityName: p.ProjectName,
		AfterState: p,
	})

	go s.notifSvc.NotifyLayer(orgID, []models.LayerType{models.LayerTwo}, models.NotifProjectCreated,
		"New Project Created", fmt.Sprintf("Project %s (%s) has been created", p.ProjectName, p.PONumber),
		&p.ID, "project", &p.ID)

	return p, nil
}

func (s *ProjectService) UpdateProject(orgID, updatedBy, projectID uuid.UUID, req CreateProjectRequest, revisionReason, clientRequest string) (*models.Project, error) {
	current, err := s.GetProject(projectID)
	if err != nil {
		return nil, err
	}

	var deliveryDate interface{}
	if req.DeliveryDate != "" {
		t, err := time.Parse("2006-01-02", req.DeliveryDate)
		if err != nil {
			return nil, errors.New("invalid delivery_date format")
		}
		deliveryDate = t
	}

	var drawingFileID interface{}
	if req.DrawingFileID != "" {
		id, err := uuid.Parse(req.DrawingFileID)
		if err != nil {
			return nil, errors.New("invalid drawing_file_id")
		}
		drawingFileID = id
	} else if current.DrawingFileID != nil {
		// preserve existing drawing if not changing
		drawingFileID = *current.DrawingFileID
	}

	p := &models.Project{}
	var (
		clientEmail, clientPhone, clientAddr, clientGSTNum sql.NullString
		deliveryAddr                         sql.NullString
		coverImg, cadURL                     sql.NullString
		jobCards, renderURL                  sql.NullString
		delivDate                            sql.NullTime
		drawFileID                           sql.NullString
		rate                                 sql.NullFloat64
	)

	err = s.db.QueryRow(`
		UPDATE projects SET
			po_number = $1, project_name = $2, client_name = $3,
			client_email = $4, client_phone = $5, client_address = $6,
			client_gst_num = $7, rate = $8,
			quantity = $9, specifications = $10,
			material_details = $11, upholstery_details = $12,
			delivery_date = $13, delivery_address = $14,
			cover_image_url = $15, cad_files_url = $16,
			job_cards_url = $17, render_files_url = $18,
			drawing_file_id = $19,
			current_revision = current_revision + 1, updated_at = NOW()
		WHERE id = $20
		RETURNING id, organization_id, po_number, project_name, client_name,
			client_email, client_phone, client_address, client_gst_num, rate, quantity,
			specifications, material_details, upholstery_details,
			delivery_date, delivery_address,
			cover_image_url, cad_files_url, job_cards_url, render_files_url,
			drawing_file_id, status, created_by, current_revision, created_at, updated_at
	`,
		req.PONumber, req.ProjectName, req.ClientName,
		nullStr(req.ClientEmail), nullStr(req.ClientPhone), nullStr(req.ClientAddress),
		nullStr(req.ClientGSTNum), nullFloat64(req.Rate),
		req.Quantity, req.Specifications,
		req.MaterialDetails, req.UpholsteryDetails,
		deliveryDate, nullStr(req.DeliveryAddress),
		nullStr(req.CoverImageURL), nullStr(req.CADFilesURL),
		nullStr(req.JobCardsURL), nullStr(req.RenderFilesURL),
		drawingFileID,
		projectID,
	).Scan(
		&p.ID, &p.OrganizationID, &p.PONumber, &p.ProjectName, &p.ClientName,
		&clientEmail, &clientPhone, &clientAddr, &clientGSTNum, &rate, &p.Quantity,
		&p.Specifications, &p.MaterialDetails, &p.UpholsteryDetails,
		&delivDate, &deliveryAddr,
		&coverImg, &cadURL, &jobCards, &renderURL,
		&drawFileID, &p.Status, &p.CreatedBy, &p.CurrentRevision, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update project: %w", err)
	}
	scanNullableProjectFields(p, clientEmail, clientPhone, clientAddr, clientGSTNum, rate,
		delivDate, deliveryAddr, coverImg, cadURL, jobCards, renderURL, drawFileID)

	prevBytes, _ := json.Marshal(current)
	afterBytes, _ := json.Marshal(p)
	var prevMap, afterMap map[string]interface{}
	json.Unmarshal(prevBytes, &prevMap)
	json.Unmarshal(afterBytes, &afterMap)

	s.db.Exec(`
		INSERT INTO project_revisions (project_id, revision_number, revised_by, reason, client_request, previous_values, updated_values)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, projectID, p.CurrentRevision, updatedBy, revisionReason, nullStr(clientRequest),
		prevBytes, afterBytes)

	s.auditSvc.Log(AuditEntry{
		OrgID: orgID, ProjectID: &p.ID, ActorID: &updatedBy,
		Action: models.AuditRevisionCreated, EntityType: "project", EntityID: &p.ID, EntityName: p.ProjectName,
		BeforeState: prevMap, AfterState: afterMap,
	})

	go s.notifSvc.NotifyOrg(orgID, models.NotifProjectRevision,
		"Project Revised", fmt.Sprintf("Project %s has been updated (Rev %d)", p.ProjectName, p.CurrentRevision),
		&p.ID, "project", &p.ID)

	return p, nil
}

// AttachDrawingFile associates a newly uploaded file as the project's drawing.
func (s *ProjectService) AttachDrawingFile(projectID, fileID uuid.UUID) error {
	_, err := s.db.Exec(`
		UPDATE projects SET drawing_file_id = $1, updated_at = NOW() WHERE id = $2
	`, fileID, projectID)
	return err
}

func (s *ProjectService) GetProject(id uuid.UUID) (*models.Project, error) {
	p := &models.Project{}
	var (
		clientEmail, clientPhone, clientAddr, clientGSTNum sql.NullString
		deliveryAddr                         sql.NullString
		coverImg, cadURL                     sql.NullString
		jobCards, renderURL                  sql.NullString
		delivDate                            sql.NullTime
		completedAt, archivedAt              sql.NullTime
		createdByName                        sql.NullString
		drawFileID                           sql.NullString
		drawFileURL                          sql.NullString
		drawFileOriginalName                 sql.NullString
		rate                                 sql.NullFloat64
	)

	err := s.db.QueryRow(`
		SELECT p.id, p.organization_id, p.po_number, p.project_name, p.client_name,
			p.client_email, p.client_phone, p.client_address, p.client_gst_num, p.rate, p.quantity,
			p.specifications, p.material_details, p.upholstery_details,
			p.delivery_date, p.delivery_address,
			p.cover_image_url, p.cad_files_url, p.job_cards_url, p.render_files_url,
			p.drawing_file_id, p.status, p.created_by, p.current_revision,
			p.completed_at, p.archived_at, p.created_at, p.updated_at,
			CONCAT(e.first_name, ' ', e.last_name) as created_by_name,
			f.s3_url as drawing_url, f.original_name as drawing_name
		FROM projects p
		LEFT JOIN employees e ON e.id = p.created_by
		LEFT JOIN file_assets f ON f.id = p.drawing_file_id
		WHERE p.id = $1
	`, id).Scan(
		&p.ID, &p.OrganizationID, &p.PONumber, &p.ProjectName, &p.ClientName,
		&clientEmail, &clientPhone, &clientAddr, &clientGSTNum, &rate, &p.Quantity,
		&p.Specifications, &p.MaterialDetails, &p.UpholsteryDetails,
		&delivDate, &deliveryAddr,
		&coverImg, &cadURL, &jobCards, &renderURL,
		&drawFileID, &p.Status, &p.CreatedBy, &p.CurrentRevision,
		&completedAt, &archivedAt, &p.CreatedAt, &p.UpdatedAt,
		&createdByName, &drawFileURL, &drawFileOriginalName,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("project not found")
	}
	if err != nil {
		return nil, err
	}

	scanNullableProjectFields(p, clientEmail, clientPhone, clientAddr, clientGSTNum, rate,
		delivDate, deliveryAddr, coverImg, cadURL, jobCards, renderURL, drawFileID)

	if completedAt.Valid {
		p.CompletedAt = &completedAt.Time
	}
	if archivedAt.Valid {
		p.ArchivedAt = &archivedAt.Time
	}
	if createdByName.Valid {
		p.CreatedByName = createdByName.String
	}
	// Embed drawing file details for the frontend with presigned URL
	if drawFileID.Valid && drawFileURL.Valid {
		fileID, _ := uuid.Parse(drawFileID.String)
		p.DrawingFileID = &fileID
		// Generate presigned URL for drawing file
		presignedURL := drawFileURL.String // fallback to stored URL
		if s.fileSvc != nil {
			// Get the S3 key from the file_assets table
			var s3Key sql.NullString
			s.db.QueryRow(`SELECT s3_key FROM file_assets WHERE id = $1`, fileID).Scan(&s3Key)
			if s3Key.Valid {
				if generatedURL, err := s.fileSvc.GetSignedURL(s3Key.String, 1*time.Hour); err == nil {
					presignedURL = generatedURL
				}
			}
		}
		p.DrawingFile = &models.FileAsset{
			ID:           fileID,
			S3URL:        presignedURL,
			OriginalName: drawFileOriginalName.String,
		}
	}
	return p, nil
}

func (s *ProjectService) GetProjectRestricted(projectID, deptID uuid.UUID) (map[string]interface{}, error) {
	var poNumber, renderFilesURL sql.NullString
	var drawFileID sql.NullString
	var drawFileKey, drawFileName sql.NullString
	var routedAt sql.NullTime
	var expectedCompletion sql.NullTime
	var completionLocked bool
	var quantity int

	err := s.db.QueryRow(`
		SELECT p.po_number, p.render_files_url, p.quantity,
		       f.id as drawing_id, f.s3_key as drawing_key, f.original_name as drawing_name,
		       t.routed_to_dept_at, t.expected_completion_date, t.completion_date_locked
		FROM projects p
		LEFT JOIN file_assets f ON f.id = p.drawing_file_id
		LEFT JOIN department_tasks t ON t.project_id = p.id AND t.department_id = $2
		WHERE p.id = $1
		ORDER BY t.created_at DESC
		LIMIT 1
	`, projectID, deptID).Scan(
		&poNumber, &renderFilesURL, &quantity,
		&drawFileID, &drawFileKey, &drawFileName,
		&routedAt, &expectedCompletion, &completionLocked,
	)
	if err == sql.ErrNoRows {
		return nil, errors.New("project not found")
	}
	if err != nil {
		return nil, err
	}

	// Generate presigned URL for drawing file
	drawingURL := ""
	if drawFileKey.Valid && s.fileSvc != nil {
		presignedURL, err := s.fileSvc.GetSignedURL(drawFileKey.String, 1*time.Hour)
		if err == nil {
			drawingURL = presignedURL
		}
	}

	result := map[string]interface{}{
		"po_number":               poNumber.String,
		"render_files_url":        renderFilesURL.String,
		"drawing_url":             drawingURL,
		"drawing_name":            drawFileName.String,
		"completion_date_locked":  completionLocked,
		"quantity":                quantity,
	}
	if routedAt.Valid {
		result["routed_to_dept_at"] = routedAt.Time
	}
	if expectedCompletion.Valid {
		result["expected_completion_date"] = expectedCompletion.Time.Format("2006-01-02")
	}
	return result, nil
}

func (s *ProjectService) ListProjects(orgID uuid.UUID, status, search string, page, pageSize int) ([]models.Project, int, error) {
	conditions := []string{"p.organization_id = $1"}
	args := []interface{}{orgID}
	argIdx := 2

	if status != "" {
		conditions = append(conditions, fmt.Sprintf("p.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}
	if search != "" {
		conditions = append(conditions, fmt.Sprintf(`(
			p.project_name ILIKE $%d OR p.po_number ILIKE $%d OR p.client_name ILIKE $%d
		)`, argIdx, argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	where := "WHERE " + joinConditions(conditions, " AND ")

	var total int
	s.db.QueryRow(`SELECT COUNT(*) FROM projects p `+where, args...).Scan(&total)

	query := fmt.Sprintf(`
		SELECT p.id, p.organization_id, p.po_number, p.project_name, p.client_name,
			p.client_gst_num, p.rate,
			p.status, p.created_by, p.current_revision, p.delivery_date,
			p.cover_image_url, p.drawing_file_id, p.created_at, p.updated_at,
			COALESCE(CONCAT(e.first_name, ' ', e.last_name), '') as created_by_name,
			f.s3_url as drawing_url
		FROM projects p
		LEFT JOIN employees e ON e.id = p.created_by
		LEFT JOIN file_assets f ON f.id = p.drawing_file_id
		%s
		ORDER BY p.created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, pageSize, (page-1)*pageSize)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var projects []models.Project
	for rows.Next() {
		var p models.Project
		var delivDate sql.NullTime
		var coverImg, createdByName, clientGSTNum sql.NullString
		var drawFileID, drawFileURL sql.NullString
		var rate sql.NullFloat64

		rows.Scan(
			&p.ID, &p.OrganizationID, &p.PONumber, &p.ProjectName, &p.ClientName,
			&clientGSTNum, &rate,
			&p.Status, &p.CreatedBy, &p.CurrentRevision, &delivDate,
			&coverImg, &drawFileID, &p.CreatedAt, &p.UpdatedAt, &createdByName,
			&drawFileURL,
		)
		if delivDate.Valid {
			p.DeliveryDate = &delivDate.Time
		}
		if coverImg.Valid {
			p.CoverImageURL = coverImg.String
		}
		if createdByName.Valid {
			p.CreatedByName = createdByName.String
		}
		if clientGSTNum.Valid {
			p.ClientGSTNum = clientGSTNum.String
		}
		if rate.Valid {
			p.Rate = rate.Float64
		}
		if drawFileID.Valid {
			fid, _ := uuid.Parse(drawFileID.String)
			p.DrawingFileID = &fid
			if drawFileURL.Valid {
				p.DrawingFile = &models.FileAsset{ID: fid, S3URL: drawFileURL.String}
			}
		}
		projects = append(projects, p)
	}

	// Fetch active task status and department name for each project
	for i := range projects {
		// Get active routing ID (is_latest = TRUE, not superseded)
		var activeRoutingID uuid.UUID
		err := s.db.QueryRow(`
			SELECT id FROM routings 
			WHERE project_id = $1 AND is_latest = TRUE AND status != 'superseded'
			LIMIT 1
		`, projects[i].ID).Scan(&activeRoutingID)
		
		if err != nil {
			continue
		}
		
		// Priority 1: Check for issue_hold
		var deptName sql.NullString
		err = s.db.QueryRow(`
			SELECT d.name FROM department_tasks dt
			JOIN departments d ON d.id = dt.department_id
			WHERE dt.project_id = $1 AND dt.routing_id = $2 AND dt.status = 'issue_hold'
			LIMIT 1
		`, projects[i].ID, activeRoutingID).Scan(&deptName)
		
		if err == nil && deptName.Valid {
			projects[i].ActiveTaskStatus = "issue_hold"
			projects[i].ActiveDepartmentName = deptName.String
			continue
		}
		
		// Priority 2: Check for on_hold
		err = s.db.QueryRow(`
			SELECT d.name FROM department_tasks dt
			JOIN departments d ON d.id = dt.department_id
			WHERE dt.project_id = $1 AND dt.routing_id = $2 AND dt.status = 'on_hold'
			LIMIT 1
		`, projects[i].ID, activeRoutingID).Scan(&deptName)
		
		if err == nil && deptName.Valid {
			projects[i].ActiveTaskStatus = "on_hold"
			projects[i].ActiveDepartmentName = deptName.String
			continue
		}
		
		// Priority 3: Check for in_progress
		err = s.db.QueryRow(`
			SELECT d.name FROM department_tasks dt
			JOIN departments d ON d.id = dt.department_id
			WHERE dt.project_id = $1 AND dt.routing_id = $2 AND dt.status = 'in_progress'
			LIMIT 1
		`, projects[i].ID, activeRoutingID).Scan(&deptName)
		
		if err == nil && deptName.Valid {
			projects[i].ActiveTaskStatus = "in_progress"
			projects[i].ActiveDepartmentName = deptName.String
			continue
		}
		
		// Priority 4: Check if all completed
		var allCompleted bool
		s.db.QueryRow(`
			SELECT NOT EXISTS (
				SELECT 1 FROM department_tasks dt
				WHERE dt.project_id = $1 AND dt.routing_id = $2
				AND dt.status NOT IN ('completed', 'archived')
			)
		`, projects[i].ID, activeRoutingID).Scan(&allCompleted)
		
		if allCompleted {
			projects[i].ActiveTaskStatus = "completed"
			projects[i].ActiveDepartmentName = "All Departments"
		}
	}

	return projects, total, nil
}

func (s *ProjectService) UpdateProjectStatus(projectID uuid.UUID, status models.ProjectStatus, actorID uuid.UUID) error {
	_, err := s.db.Exec(`
		UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2
	`, status, projectID)
	if err != nil {
		return err
	}
	if status == models.ProjectCompleted {
		s.db.Exec(`UPDATE projects SET completed_at = NOW() WHERE id = $1`, projectID)
	}
	if status == models.ProjectArchived {
		s.db.Exec(`UPDATE projects SET archived_at = NOW() WHERE id = $1`, projectID)
	}
	return nil
}

func (s *ProjectService) GetProjectRevisions(projectID uuid.UUID) ([]models.ProjectRevision, error) {
	rows, err := s.db.Query(`
		SELECT pr.id, pr.project_id, pr.revision_number, pr.revised_by,
		       pr.reason, pr.client_request, pr.previous_values, pr.updated_values,
		       pr.routing_changed, pr.departments_reopened, pr.subtasks_reopened,
		       pr.notifications_sent, pr.created_at,
		       COALESCE(CONCAT(e.first_name, ' ', e.last_name), '') as revised_by_name
		FROM project_revisions pr
		LEFT JOIN employees e ON e.id = pr.revised_by
		WHERE pr.project_id = $1
		ORDER BY pr.revision_number DESC
	`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var revisions []models.ProjectRevision
	for rows.Next() {
		var r models.ProjectRevision
		var clientReq sql.NullString
		var prevValues, updValues []byte
		var deptReopened []byte
		var subtasksReopened []byte

		rows.Scan(
			&r.ID, &r.ProjectID, &r.RevisionNumber, &r.RevisedBy,
			&r.Reason, &clientReq, &prevValues, &updValues,
			&r.RoutingChanged, &deptReopened, &subtasksReopened,
			&r.NotificationsSent, &r.CreatedAt, &r.RevisedByName,
		)
		if clientReq.Valid {
			r.ClientRequest = clientReq.String
		}
		json.Unmarshal(prevValues, &r.PreviousValues)
		json.Unmarshal(updValues, &r.UpdatedValues)
		revisions = append(revisions, r)
	}
	return revisions, nil
}

func scanNullableProjectFields(p *models.Project,
	clientEmail, clientPhone, clientAddr, clientGSTNum sql.NullString,
	rate sql.NullFloat64,
	delivDate sql.NullTime, deliveryAddr sql.NullString,
	coverImg, cadURL, jobCards, renderURL, drawFileID sql.NullString,
) {
	if clientEmail.Valid {
		p.ClientEmail = clientEmail.String
	}
	if clientPhone.Valid {
		p.ClientPhone = clientPhone.String
	}
	if clientAddr.Valid {
		p.ClientAddress = clientAddr.String
	}
	if clientGSTNum.Valid {
		p.ClientGSTNum = clientGSTNum.String
	}
	if rate.Valid {
		p.Rate = rate.Float64
	}
	if delivDate.Valid {
		p.DeliveryDate = &delivDate.Time
	}
	if deliveryAddr.Valid {
		p.DeliveryAddress = deliveryAddr.String
	}
	if coverImg.Valid {
		p.CoverImageURL = coverImg.String
	}
	if cadURL.Valid {
		p.CADFilesURL = cadURL.String
	}
	if jobCards.Valid {
		p.JobCardsURL = jobCards.String
	}
	if renderURL.Valid {
		p.RenderFilesURL = renderURL.String
	}
	if drawFileID.Valid {
		id, _ := uuid.Parse(drawFileID.String)
		p.DrawingFileID = &id
	}
}

func nullBytes(b []byte) interface{} {
	if len(b) == 0 {
		return nil
	}
	return string(b)
}
