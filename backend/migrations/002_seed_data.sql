-- ============================================================
-- PMS - Seed: Default Organization + Super Admin
-- ============================================================

-- Default organization
INSERT INTO organizations (id, name, description)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Furniture Manufacturing Co.',
    'Default organization for PMS'
) ON CONFLICT DO NOTHING;

-- Super Admin account (password: Admin@123 - bcrypt hash)
-- Change this immediately after first login!
