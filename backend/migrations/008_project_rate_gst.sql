-- ============================================================
-- PMS - Production Management System
-- Migration 008: Add Rate and Client GST Number to Projects
-- ============================================================

-- Add client_gst_num field to projects table
ALTER TABLE projects 
ADD COLUMN client_gst_num VARCHAR(50);

-- Add rate field to projects table
ALTER TABLE projects 
ADD COLUMN rate NUMERIC(12,2);

-- Add comments for documentation
COMMENT ON COLUMN projects.client_gst_num IS 'Client GST number for billing purposes';
COMMENT ON COLUMN projects.rate IS 'Project rate/price for billing purposes';
