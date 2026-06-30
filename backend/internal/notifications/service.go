package notifications

import (
	"github.com/jmoiron/sqlx"
)

// Service provides notification helpers.
type Service struct{ db *sqlx.DB }

func NewService(db *sqlx.DB) *Service { return &Service{db: db} }

// Send persists a notification for a single target.
func (s *Service) Send(n *Notification) error {
	_, err := s.db.Exec(`
		INSERT INTO notifications (recipient_id, dept_id, project_id, issue_id, title, body, type)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		n.RecipientID, n.DeptID, n.ProjectID, n.IssueID, n.Title, n.Body, n.Type)
	return err
}

// NotifyAllLayer2 sends a dept-wide notification to every L2 department.
func (s *Service) NotifyAllLayer2(projectID, issueID, nType, title, body string) {
	var deptIDs []string
	_ = s.db.Select(&deptIDs, `SELECT id::text FROM departments WHERE layer=2 AND deleted_at IS NULL`)
	for _, id := range deptIDs {
		deptIDCopy := id
		pID := &projectID
		var iID *string
		if issueID != "" {
			iID = &issueID
		}
		_ = s.Send(&Notification{
			DeptID:    &deptIDCopy,
			ProjectID: pID,
			IssueID:   iID,
			Title:     title,
			Body:      &body,
			Type:      nType,
		})
	}
}

// NotifyDept sends a notification to a specific department.
func (s *Service) NotifyDept(deptID, projectID, issueID, nType, title, body string) {
	var iID *string
	if issueID != "" {
		iID = &issueID
	}
	_ = s.Send(&Notification{
		DeptID:    &deptID,
		ProjectID: &projectID,
		IssueID:   iID,
		Title:     title,
		Body:      &body,
		Type:      nType,
	})
}

// NotifyUser sends a notification to a specific user.
func (s *Service) NotifyUser(userID, projectID, issueID, nType, title, body string) {
	var iID *string
	if issueID != "" {
		iID = &issueID
	}
	_ = s.Send(&Notification{
		RecipientID: &userID,
		ProjectID:   &projectID,
		IssueID:     iID,
		Title:       title,
		Body:        &body,
		Type:        nType,
	})
}
