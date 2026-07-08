-- ============================================================
-- Migration 003: Project Flow Improvements
-- ============================================================

-- Add drawing_file_id to projects (replaces drawings_url)
ALTER TABLE projects ADD COLUMN drawing_file_id UUID REFERENCES file_assets(id);

-- Remove deprecated fields from projects
ALTER TABLE projects DROP COLUMN IF EXISTS dimensions;
ALTER TABLE projects DROP COLUMN IF EXISTS color_details;
ALTER TABLE projects DROP COLUMN IF EXISTS finish_details;
ALTER TABLE projects DROP COLUMN IF EXISTS remarks;
ALTER TABLE projects DROP COLUMN IF EXISTS drawings_url;

-- Add expected completion date and lock to department_tasks
ALTER TABLE department_tasks ADD COLUMN expected_completion_date DATE;
ALTER TABLE department_tasks ADD COLUMN completion_date_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE department_tasks ADD COLUMN routed_to_dept_at TIMESTAMPTZ;

-- Create routing_edit_timeline table
CREATE TABLE routing_edit_timeline (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    routing_id      UUID NOT NULL REFERENCES routings(id) ON DELETE CASCADE,
    edited_by       UUID NOT NULL REFERENCES employees(id),
    editor_email    VARCHAR(255) NOT NULL,
    editor_name     VARCHAR(255) NOT NULL,
    edit_reason     TEXT NOT NULL,
    changes_summary TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_routing_timeline_routing ON routing_edit_timeline(routing_id);
CREATE INDEX idx_routing_timeline_created ON routing_edit_timeline(created_at DESC);

-- Add material requisition fields to issues for material_missing type
ALTER TABLE issues ADD COLUMN material_description TEXT;
ALTER TABLE issues ADD COLUMN required_quantity DECIMAL(10,3);
ALTER TABLE issues ADD COLUMN material_unit VARCHAR(50);
ALTER TABLE issues ADD COLUMN material_remarks TEXT;

-- Create index on drawing_file_id
CREATE INDEX idx_projects_drawing_file ON projects(drawing_file_id);
