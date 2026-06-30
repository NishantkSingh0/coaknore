BEGIN;

-- ============================================================
-- 5. project_department_tasks
--    NOTE: is_overdue is a VIEW column (CURRENT_DATE is volatile,
--    so it can't be a stored generated column in PostgreSQL).
--    We compute it in queries instead.
-- ============================================================
CREATE TABLE IF NOT EXISTS project_department_tasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    routing_id          UUID NOT NULL REFERENCES project_department_routing(id) ON DELETE CASCADE,
    project_id          UUID NOT NULL REFERENCES projects(id),
    department_id       UUID NOT NULL REFERENCES departments(id),
    assigned_to_user_id UUID REFERENCES users(id),
    start_date          DATE,
    due_date            DATE,
    status              VARCHAR(30) DEFAULT 'pending'
                            CHECK (status IN ('pending','in_progress','hold','issue_hold','completed')),
    completed_at        TIMESTAMPTZ,
    addon               VARCHAR(500),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(routing_id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_project  ON project_department_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_dept     ON project_department_tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status   ON project_department_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON project_department_tasks(due_date);

-- ============================================================
-- 6. issues
-- ============================================================
CREATE TABLE IF NOT EXISTS issues (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id             UUID REFERENCES project_department_tasks(id),
    raised_by_dept_id   UUID NOT NULL REFERENCES departments(id),
    raised_by_user_id   UUID NOT NULL REFERENCES users(id),
    issue_type          VARCHAR(50) NOT NULL
                            CHECK (issue_type IN ('item_missing','design_change','routing_required','fullscale_required','rework_required')),
    status              VARCHAR(30) DEFAULT 'open'
                            CHECK (status IN ('open','pending_approval','approved','rejected','closed')),
    description         VARCHAR(1000),
    approved_by_user_id UUID REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    closed_at           TIMESTAMPTZ,
    addon               VARCHAR(500),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issues_project     ON issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_status      ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_type        ON issues(issue_type);
CREATE INDEX IF NOT EXISTS idx_issues_raised_dept ON issues(raised_by_dept_id);

-- ============================================================
-- 7. material_requisitions
-- ============================================================
CREATE TABLE IF NOT EXISTS material_requisitions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id     UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    department   VARCHAR(100) NOT NULL,
    request_date DATE NOT NULL,
    is_approved  BOOLEAN DEFAULT FALSE,
    approved_by  UUID REFERENCES users(id),
    approved_at  TIMESTAMPTZ,
    addon        VARCHAR(500),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. material_requisition_items
-- ============================================================
CREATE TABLE IF NOT EXISTS material_requisition_items (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id       UUID NOT NULL REFERENCES material_requisitions(id) ON DELETE CASCADE,
    material_name        VARCHAR(200) NOT NULL,
    material_description VARCHAR(500),
    quantity_required    DECIMAL(10,2) NOT NULL,
    unit                 VARCHAR(30),
    addon                VARCHAR(500),
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. rework_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS rework_requests (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id    UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    description VARCHAR(1000) NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    addon       VARCHAR(500),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    dept_id      UUID REFERENCES departments(id) ON DELETE CASCADE,
    project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
    issue_id     UUID REFERENCES issues(id) ON DELETE SET NULL,
    title        VARCHAR(200) NOT NULL,
    body         VARCHAR(500),
    type         VARCHAR(50) NOT NULL,
    is_read      BOOLEAN DEFAULT FALSE,
    read_at      TIMESTAMPTZ,
    addon        VARCHAR(500),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notif_dept      ON notifications(dept_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notif_created   ON notifications(created_at DESC);

COMMIT;
