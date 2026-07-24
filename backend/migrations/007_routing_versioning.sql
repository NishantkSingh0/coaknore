-- Remove the one-routing-per-project constraint to allow multiple routing versions
-- This enables the new routing versioning system where editing creates new versions instead of modifying existing ones

-- Remove the UNIQUE constraint on (project_id, version) to allow multiple active routings per project
-- We'll keep version tracking but allow multiple routings with different versions
ALTER TABLE routings DROP CONSTRAINT IF EXISTS routings_project_id_version_key;

-- Add index to efficiently query latest routing per project
CREATE INDEX idx_routings_project_version ON routings(project_id, version DESC);

-- Add column to track if routing is the latest version for a project
ALTER TABLE routings ADD COLUMN is_latest BOOLEAN NOT NULL DEFAULT TRUE;

-- Add column to track change reason for routing versions
ALTER TABLE routings ADD COLUMN change_reason TEXT;

-- Update routing_edit_timeline to include more detailed change information
ALTER TABLE routing_edit_timeline ADD COLUMN previous_routing_id UUID REFERENCES routings(id);
ALTER TABLE routing_edit_timeline ADD COLUMN new_routing_id UUID REFERENCES routings(id);
ALTER TABLE routing_edit_timeline ADD COLUMN change_type VARCHAR(50) NOT NULL DEFAULT 'edit'; -- 'edit', 'new_version', 'supersede'

-- Add index for efficient querying of routing changes
CREATE INDEX idx_routing_edit_timeline_routing ON routing_edit_timeline(routing_id);
CREATE INDEX idx_routing_edit_timeline_project ON routing_edit_timeline(previous_routing_id);
CREATE INDEX idx_routing_edit_timeline_new ON routing_edit_timeline(new_routing_id);
