package notifications

import "time"

type Notification struct {
	ID          string     `db:"id"           json:"id"`
	RecipientID *string    `db:"recipient_id" json:"recipient_id"`
	DeptID      *string    `db:"dept_id"      json:"dept_id"`
	ProjectID   *string    `db:"project_id"   json:"project_id"`
	IssueID     *string    `db:"issue_id"     json:"issue_id"`
	Title       string     `db:"title"        json:"title"`
	Body        *string    `db:"body"         json:"body"`
	Type        string     `db:"type"         json:"type"`
	IsRead      bool       `db:"is_read"      json:"is_read"`
	ReadAt      *time.Time `db:"read_at"      json:"read_at"`
	Addon       *string    `db:"addon"        json:"addon"`
	CreatedAt   time.Time  `db:"created_at"   json:"created_at"`
}

// Target describes who should receive a notification.
type Target struct {
	UserID *string
	DeptID *string
}
