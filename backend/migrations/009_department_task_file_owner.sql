-- ============================================================
-- Migration 009: Add department_task to file_owner_type enum
-- ============================================================

-- Add department_task to the file_owner_type enum
ALTER TYPE file_owner_type ADD VALUE 'department_task';
