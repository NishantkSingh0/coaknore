-- ============================================================
-- PMS - Production Management System
-- Migration 001: Initial Schema
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE layer_type AS ENUM ('super_admin', 'layer1', 'layer2', 'layer3');

CREATE TYPE department_layer AS ENUM ('layer2', 'layer3');

CREATE TYPE project_status AS ENUM (
    'created', 'routing', 'in_progress', 'completed', 'archived', 'on_hold'
);

CREATE TYPE task_status AS ENUM (
    'pending', 'in_progress', 'hold', 'issue_hold', 'completed', 'on_hold'
);

CREATE TYPE subtask_status AS ENUM ('pending', 'in_progress', 'completed');

CREATE TYPE routing_status AS ENUM ('draft', 'active', 'superseded', 'archived');

CREATE TYPE dependency_policy AS ENUM ('require_all', 'require_any');

CREATE TYPE issue_status AS ENUM (
    'open', 'pending_approval', 'approved', 'rejected', 'resolved', 'closed'
);

CREATE TYPE issue_type AS ENUM (
    'material_missing', 'design_change', 'routing_required',
    'full_scale_requirement', 'quality_issue', 'rework_required', 'custom'
);

CREATE TYPE rework_status AS ENUM (
    'pending', 'approved', 'rejected', 'in_progress', 'completed'
);

CREATE TYPE query_status AS ENUM (
    'open', 'sender_resolved', 'recipient_resolved', 'closed'
);

CREATE TYPE notification_type AS ENUM (
    'project_created', 'routing_assigned', 'routing_updated',
    'task_assigned', 'task_started', 'task_completed',
    'subtask_completed', 'proof_uploaded', 'daily_report_submitted',
    'issue_raised', 'issue_approved', 'issue_closed',
    'material_request', 'rework_request', 'query_received',
    'project_revision', 'department_reopened', 'overdue_task',
    'rework_approved', 'rework_rejected', 'issue_rejected',
    'query_replied', 'query_closed', 'material_approved', 'material_rejected'
);

CREATE TYPE material_request_status AS ENUM (
    'pending', 'approved', 'rejected', 'fulfilled'
);

CREATE TYPE file_owner_type AS ENUM (
    'project', 'project_revision', 'task', 'subtask',
    'issue', 'daily_report', 'query', 'rework_request', 'material_request'
);

CREATE TYPE audit_action AS ENUM (
    'created', 'updated', 'deleted', 'status_changed',
    'assigned', 'completed', 'approved', 'rejected',
    'resolved', 'closed', 'reopened', 'archived',
    'file_uploaded', 'revision_created', 'routing_published'
);

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DEPARTMENTS
-- ============================================================

CREATE TABLE departments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    layer           department_layer NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

CREATE INDEX idx_departments_org ON departments(organization_id);
CREATE INDEX idx_departments_layer ON departments(layer);

-- ============================================================
-- EMPLOYEES
-- ============================================================

CREATE TABLE employees (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    department_id       UUID REFERENCES departments(id),
    email               VARCHAR(255) NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    phone               VARCHAR(20),
    avatar_url          TEXT,
    layer               layer_type NOT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at       TIMESTAMPTZ,
    password_reset_token TEXT,
    password_reset_expires TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employees_org ON employees(organization_id);
CREATE INDEX idx_employees_dept ON employees(department_id);
CREATE INDEX idx_employees_email ON employees(email);
CREATE INDEX idx_employees_layer ON employees(layer);

-- ============================================================
-- PROJECTS
-- ============================================================

CREATE TABLE projects (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    po_number           VARCHAR(100) NOT NULL,
    project_name        VARCHAR(500) NOT NULL,
    client_name         VARCHAR(255) NOT NULL,
    client_email        VARCHAR(255),
    client_phone        VARCHAR(50),
    client_address      TEXT,
    quantity            INTEGER NOT NULL DEFAULT 1,
    dimensions          JSONB,       -- {width, height, depth, unit}
    specifications      TEXT,
    material_details    TEXT,
    color_details       TEXT,
    upholstery_details  TEXT,
    finish_details      TEXT,
    delivery_date       DATE,
    delivery_address    TEXT,
    remarks             TEXT,
    cover_image_url     TEXT,
    cad_files_url       TEXT,
    drawings_url        TEXT,
    job_cards_url       TEXT,
    render_files_url    TEXT,
    status              project_status NOT NULL DEFAULT 'created',
    created_by          UUID NOT NULL REFERENCES employees(id),
    current_revision    INTEGER NOT NULL DEFAULT 1,
    completed_at        TIMESTAMPTZ,
    archived_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_po ON projects(po_number);
CREATE INDEX idx_projects_client ON projects(client_name);
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_delivery ON projects(delivery_date);

-- Full text search index
CREATE INDEX idx_projects_fts ON projects
    USING GIN(to_tsvector('english', project_name || ' ' || po_number || ' ' || client_name));

-- ============================================================
-- PROJECT REVISIONS
-- ============================================================

CREATE TABLE project_revisions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    revision_number     INTEGER NOT NULL,
    revised_by          UUID NOT NULL REFERENCES employees(id),
    reason              TEXT NOT NULL,
    client_request      TEXT,
    previous_values     JSONB NOT NULL DEFAULT '{}',
    updated_values      JSONB NOT NULL DEFAULT '{}',
    routing_changed     BOOLEAN NOT NULL DEFAULT FALSE,
    departments_reopened UUID[] DEFAULT '{}',
    subtasks_reopened   UUID[] DEFAULT '{}',
    notifications_sent  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, revision_number)
);

CREATE INDEX idx_revisions_project ON project_revisions(project_id);

-- ============================================================
-- ROUTINGS
-- ============================================================

CREATE TABLE routings (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version          INTEGER NOT NULL DEFAULT 1,
    name             VARCHAR(255),
    description      TEXT,
    status           routing_status NOT NULL DEFAULT 'draft',
    parent_routing_id UUID REFERENCES routings(id),
    routing_type     VARCHAR(50) NOT NULL DEFAULT 'standard', -- standard, rework
    created_by       UUID NOT NULL REFERENCES employees(id),
    published_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, version)
);

CREATE INDEX idx_routings_project ON routings(project_id);
CREATE INDEX idx_routings_status ON routings(status);

-- ============================================================
-- ROUTING STEPS
-- ============================================================

CREATE TABLE routing_steps (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    routing_id        UUID NOT NULL REFERENCES routings(id) ON DELETE CASCADE,
    step_order        INTEGER NOT NULL,
    name              VARCHAR(255),
    dependency_policy dependency_policy NOT NULL DEFAULT 'require_all',
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(routing_id, step_order)
);

CREATE INDEX idx_routing_steps_routing ON routing_steps(routing_id);

-- ============================================================
-- ROUTING STEP DEPARTMENTS (which depts run in parallel in a step)
-- ============================================================

CREATE TABLE routing_step_departments (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    routing_step_id  UUID NOT NULL REFERENCES routing_steps(id) ON DELETE CASCADE,
    department_id    UUID NOT NULL REFERENCES departments(id),
    UNIQUE(routing_step_id, department_id)
);

CREATE INDEX idx_rsd_step ON routing_step_departments(routing_step_id);
CREATE INDEX idx_rsd_dept ON routing_step_departments(department_id);

-- ============================================================
-- DEPARTMENT TASKS
-- ============================================================

CREATE TABLE department_tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    routing_id      UUID NOT NULL REFERENCES routings(id),
    routing_step_id UUID NOT NULL REFERENCES routing_steps(id),
    department_id   UUID NOT NULL REFERENCES departments(id),
    title           VARCHAR(500),
    description     TEXT,
    priority        INTEGER NOT NULL DEFAULT 2, -- 1=low, 2=medium, 3=high, 4=critical
    status          task_status NOT NULL DEFAULT 'pending',
    start_date      DATE,
    due_date        DATE,
    dates_frozen    BOOLEAN NOT NULL DEFAULT FALSE,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_project ON department_tasks(project_id);
CREATE INDEX idx_tasks_routing ON department_tasks(routing_id);
CREATE INDEX idx_tasks_dept ON department_tasks(department_id);
CREATE INDEX idx_tasks_status ON department_tasks(status);
CREATE INDEX idx_tasks_due ON department_tasks(due_date);

-- ============================================================
-- TASK EMPLOYEE ASSIGNMENTS
-- ============================================================

CREATE TABLE task_employee_assignments (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id     UUID NOT NULL REFERENCES department_tasks(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(task_id, employee_id)
);

CREATE INDEX idx_tea_task ON task_employee_assignments(task_id);
CREATE INDEX idx_tea_employee ON task_employee_assignments(employee_id);

-- ============================================================
-- SUBTASKS
-- ============================================================

CREATE TABLE subtasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id         UUID NOT NULL REFERENCES department_tasks(id) ON DELETE CASCADE,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    is_required     BOOLEAN NOT NULL DEFAULT TRUE,
    status          subtask_status NOT NULL DEFAULT 'pending',
    assigned_to     UUID REFERENCES employees(id),
    notes           TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    completed_at    TIMESTAMPTZ,
    completed_by    UUID REFERENCES employees(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subtasks_task ON subtasks(task_id);
CREATE INDEX idx_subtasks_assigned ON subtasks(assigned_to);
CREATE INDEX idx_subtasks_status ON subtasks(status);

-- ============================================================
-- ISSUES
-- ============================================================

CREATE TABLE issues (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id         UUID REFERENCES department_tasks(id),
    department_id   UUID NOT NULL REFERENCES departments(id),
    raised_by       UUID NOT NULL REFERENCES employees(id),
    type            issue_type NOT NULL,
    title           VARCHAR(500) NOT NULL,
    description     TEXT NOT NULL,
    status          issue_status NOT NULL DEFAULT 'open',
    assigned_to_dept UUID REFERENCES departments(id),
    reviewed_by     UUID REFERENCES employees(id),
    review_notes    TEXT,
    reviewed_at     TIMESTAMPTZ,
    resolved_by     UUID REFERENCES employees(id),
    resolved_at     TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_issues_project ON issues(project_id);
CREATE INDEX idx_issues_task ON issues(task_id);
CREATE INDEX idx_issues_dept ON issues(department_id);
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_raised_by ON issues(raised_by);

-- ============================================================
-- REWORK REQUESTS
-- ============================================================

CREATE TABLE rework_requests (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    requesting_task_id  UUID NOT NULL REFERENCES department_tasks(id),
    requesting_dept_id  UUID NOT NULL REFERENCES departments(id),
    requested_by        UUID NOT NULL REFERENCES employees(id),
    target_department_id UUID NOT NULL REFERENCES departments(id),
    reason              TEXT NOT NULL,
    description         TEXT,
    status              rework_status NOT NULL DEFAULT 'pending',
    reviewed_by         UUID REFERENCES employees(id),
    review_notes        TEXT,
    reviewed_at         TIMESTAMPTZ,
    new_routing_id      UUID REFERENCES routings(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rework_project ON rework_requests(project_id);
CREATE INDEX idx_rework_status ON rework_requests(status);
CREATE INDEX idx_rework_requested_by ON rework_requests(requested_by);

-- ============================================================
-- MATERIAL REQUISITIONS
-- ============================================================

CREATE TABLE material_requisitions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id      UUID REFERENCES department_tasks(id),
    department_id UUID NOT NULL REFERENCES departments(id),
    requested_by UUID NOT NULL REFERENCES employees(id),
    title        VARCHAR(500) NOT NULL,
    description  TEXT,
    status       material_request_status NOT NULL DEFAULT 'pending',
    reviewed_by  UUID REFERENCES employees(id),
    review_notes TEXT,
    reviewed_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE material_items (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requisition_id      UUID NOT NULL REFERENCES material_requisitions(id) ON DELETE CASCADE,
    material_name       VARCHAR(255) NOT NULL,
    quantity            DECIMAL(10,3) NOT NULL,
    unit                VARCHAR(50) NOT NULL,
    description         TEXT,
    estimated_cost      DECIMAL(12,2),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_matreq_project ON material_requisitions(project_id);
CREATE INDEX idx_matreq_dept ON material_requisitions(department_id);
CREATE INDEX idx_matreq_status ON material_requisitions(status);

-- ============================================================
-- QUERIES (Cross-layer Communication)
-- ============================================================

CREATE TABLE queries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    subject         VARCHAR(500) NOT NULL,
    sender_id       UUID NOT NULL REFERENCES employees(id),
    recipient_id    UUID NOT NULL REFERENCES employees(id),
    status          query_status NOT NULL DEFAULT 'open',
    sender_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    recipient_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_queries_project ON queries(project_id);
CREATE INDEX idx_queries_sender ON queries(sender_id);
CREATE INDEX idx_queries_recipient ON queries(recipient_id);
CREATE INDEX idx_queries_status ON queries(status);

CREATE TABLE query_messages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_id    UUID NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
    sender_id   UUID NOT NULL REFERENCES employees(id),
    message     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qmessages_query ON query_messages(query_id);

-- ============================================================
-- DAILY REPORTS
-- ============================================================

CREATE TABLE daily_reports (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id),
    submitted_by  UUID NOT NULL REFERENCES employees(id),
    task_id       UUID REFERENCES department_tasks(id),
    description   TEXT NOT NULL,
    report_date   DATE NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dailyreports_project ON daily_reports(project_id);
CREATE INDEX idx_dailyreports_dept ON daily_reports(department_id);
CREATE INDEX idx_dailyreports_date ON daily_reports(report_date);

-- ============================================================
-- FILE ASSETS
-- ============================================================

CREATE TABLE file_assets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    owner_type      file_owner_type NOT NULL,
    owner_id        UUID NOT NULL,
    project_id      UUID REFERENCES projects(id),
    file_name       VARCHAR(500) NOT NULL,
    original_name   VARCHAR(500) NOT NULL,
    file_size       BIGINT NOT NULL,
    mime_type       VARCHAR(255) NOT NULL,
    s3_key          TEXT NOT NULL,
    s3_url          TEXT NOT NULL,
    uploaded_by     UUID NOT NULL REFERENCES employees(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_files_owner ON file_assets(owner_type, owner_id);
CREATE INDEX idx_files_project ON file_assets(project_id);
CREATE INDEX idx_files_uploaded_by ON file_assets(uploaded_by);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    recipient_id    UUID NOT NULL REFERENCES employees(id),
    type            notification_type NOT NULL,
    title           VARCHAR(500) NOT NULL,
    body            TEXT,
    project_id      UUID REFERENCES projects(id),
    entity_type     VARCHAR(100),
    entity_id       UUID,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read);
CREATE INDEX idx_notifications_project ON notifications(project_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ============================================================
-- AUDIT LOG (IMMUTABLE - no updates or deletes ever)
-- ============================================================

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    project_id      UUID REFERENCES projects(id),
    actor_id        UUID REFERENCES employees(id),
    actor_name      VARCHAR(255),
    action          audit_action NOT NULL,
    entity_type     VARCHAR(100) NOT NULL,
    entity_id       UUID,
    entity_name     VARCHAR(500),
    before_state    JSONB,
    after_state     JSONB,
    metadata        JSONB DEFAULT '{}',
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_project ON audit_logs(project_id);
CREATE INDEX idx_audit_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ============================================================
-- ROUTING TEMPLATES (reusable routing patterns)
-- ============================================================

CREATE TABLE routing_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    template_data   JSONB NOT NULL DEFAULT '{}',
    created_by      UUID NOT NULL REFERENCES employees(id),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_org ON routing_templates(organization_id);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_routings_updated_at BEFORE UPDATE ON routings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON department_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subtasks_updated_at BEFORE UPDATE ON subtasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_issues_updated_at BEFORE UPDATE ON issues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rework_updated_at BEFORE UPDATE ON rework_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_matreq_updated_at BEFORE UPDATE ON material_requisitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_queries_updated_at BEFORE UPDATE ON queries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON routing_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
