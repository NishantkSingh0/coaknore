-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. departments
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100)  NOT NULL UNIQUE,
    layer       SMALLINT      NOT NULL CHECK (layer IN (2, 3)),
    description VARCHAR(300),
    is_active   BOOLEAN DEFAULT TRUE,
    addon       VARCHAR(500),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

-- ============================================================
-- 2. users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100)  NOT NULL,
    email           VARCHAR(150)  UNIQUE NOT NULL,
    password_hash   VARCHAR(255)  NOT NULL,
    phone           VARCHAR(20),
    role            VARCHAR(30)   NOT NULL CHECK (role IN ('admin','layer2','layer3')),
    department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    addon           VARCHAR(500),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- ============================================================
-- 3. projects
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number           CHAR(5)       NOT NULL UNIQUE,
    project_name        VARCHAR(50)   NOT NULL,
    receiving_date      DATE          NOT NULL,
    image_url           VARCHAR(500),
    quantity            INTEGER       NOT NULL CHECK (quantity > 0),
    rates               BIGINT        NOT NULL,
    dimensions          VARCHAR(50),
    remarks             VARCHAR(500),
    specification       VARCHAR(500),
    upholstery_finish   VARCHAR(500),
    cad_urls            VARCHAR(500),
    pdf_urls            VARCHAR(500),
    render_urls         VARCHAR(500),
    jobcard_urls        VARCHAR(500),
    current_status      VARCHAR(30)   DEFAULT 'pending'
                            CHECK (current_status IN ('pending','routing_set','in_progress','completed','on_hold')),
    created_by          UUID REFERENCES users(id),
    routing_set_at      TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    addon               VARCHAR(500),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_projects_po_number  ON projects(po_number);
CREATE INDEX IF NOT EXISTS idx_projects_status     ON projects(current_status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);

-- ============================================================
-- 4. project_department_routing
-- ============================================================
CREATE TABLE IF NOT EXISTS project_department_routing (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    department_id   UUID NOT NULL REFERENCES departments(id),
    sequence_order  SMALLINT NOT NULL,
    status          VARCHAR(30) DEFAULT 'pending'
                        CHECK (status IN ('pending','in_progress','completed','skipped')),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    set_by_user_id  UUID REFERENCES users(id),
    addon           VARCHAR(500),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(project_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_routing_project ON project_department_routing(project_id);
CREATE INDEX IF NOT EXISTS idx_routing_dept    ON project_department_routing(department_id);
CREATE INDEX IF NOT EXISTS idx_routing_seq     ON project_department_routing(project_id, sequence_order);

-- ============================================================
-- 5. project_department_tasks
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
    is_overdue          BOOLEAN GENERATED ALWAYS AS (
                            due_date < CURRENT_DATE AND status != 'completed'
                        ) STORED,
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
-- 10. daily_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_reports (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id),
    submitted_by  UUID NOT NULL REFERENCES users(id),
    report_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    description   TEXT NOT NULL,
    image_url     VARCHAR(500),
    addon         VARCHAR(500),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_project ON daily_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_reports_dept    ON daily_reports(department_id);
CREATE INDEX IF NOT EXISTS idx_reports_date    ON daily_reports(report_date DESC);

-- ============================================================
-- 11. notifications
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

-- ============================================================
-- 12. audit_logs  (immutable — no deleted_at)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    entity_type   VARCHAR(50) NOT NULL,
    entity_id     UUID NOT NULL,
    action        VARCHAR(100) NOT NULL,
    old_value     JSONB,
    new_value     JSONB,
    ip_address    INET,
    addon         VARCHAR(500),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_time   ON audit_logs(created_at DESC);

-- ============================================================
-- attendance (side-effect of daily_report submission)
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id),
    department_id UUID NOT NULL REFERENCES departments(id),
    report_id     UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    date          DATE NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, date)  -- one attendance entry per user per day
);

CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_dept ON attendance(department_id, date);

-- ============================================================
-- Seed data
-- ============================================================
INSERT INTO departments (name, layer, description) VALUES
    ('Production',  2, 'L2 — orchestrates project routing'),
    ('Operation',   2, 'L2 — read-only operations oversight'),
    ('Floor',       2, 'L2 — floor-level oversight'),
    ('Design',      3, 'L3 — design and CAD work'),
    ('Carpentry',   3, 'L3 — carpentry and woodwork'),
    ('Metal',       3, 'L3 — metal fabrication'),
    ('Stone',       3, 'L3 — stone work'),
    ('Apostasy',    3, 'L3 — apostasy finishing'),
    ('Polishing',   3, 'L3 — surface polishing'),
    ('Assembly',    3, 'L3 — final assembly'),
    ('Packing',     3, 'L3 — packing and dispatch')
ON CONFLICT (name) DO NOTHING;
