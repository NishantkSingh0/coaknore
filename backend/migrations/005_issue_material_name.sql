-- Store the item name directly on material-missing issues so all issue details
-- are visible from the unified Issues section.
ALTER TABLE issues ADD COLUMN IF NOT EXISTS material_name VARCHAR(255);
