-- ============================================================
-- Migration 006: Upcoming Tasks for Departments
-- ============================================================

-- Create upcoming_tasks table to show departments their future work
CREATE TABLE upcoming_tasks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    routing_id      UUID NOT NULL REFERENCES routings(id) ON DELETE CASCADE,
    routing_step_id UUID NOT NULL REFERENCES routing_steps(id) ON DELETE CASCADE,
    department_id   UUID NOT NULL REFERENCES departments(id),
    step_order      INTEGER NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, routing_step_id, department_id)
);

CREATE INDEX idx_upcoming_project ON upcoming_tasks(project_id);
CREATE INDEX idx_upcoming_routing ON upcoming_tasks(routing_id);
CREATE INDEX idx_upcoming_dept ON upcoming_tasks(department_id);
CREATE INDEX idx_upcoming_step_order ON upcoming_tasks(step_order);
