-- Create AI_READONLY user for the AI Database Assistant
-- This user has read-only access to business tables for information retrieval

-- Create the AI_READONLY user
-- Note: Replace 'your_secure_password_here' with a strong password
DO
$$
DECLARE
  db_name text := current_database();
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ai_readonly') THEN
    EXECUTE format('CREATE ROLE ai_readonly WITH LOGIN PASSWORD %L', 'your_secure_password_here');
  END IF;

  EXECUTE format('GRANT CONNECT ON DATABASE %I TO ai_readonly', db_name);
END
$$;

-- Grant USAGE on the public schema
GRANT USAGE ON SCHEMA public TO ai_readonly;

-- Grant SELECT on all business tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ai_readonly;

-- Grant SELECT on future tables in the public schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ai_readonly;

-- Grant SELECT on all sequences (needed for some queries)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ai_readonly;

-- Ensure the user cannot modify data
-- Explicitly deny write permissions
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM ai_readonly;
DO
$$
DECLARE
  db_name text := current_database();
BEGIN
  EXECUTE format('REVOKE CREATE, TEMPORARY ON DATABASE %I FROM ai_readonly', db_name);
END
$$;
REVOKE ALL ON SCHEMA public FROM ai_readonly;
GRANT USAGE ON SCHEMA public TO ai_readonly;

-- Note: After running this migration, update your .env file with:
-- AI_READONLY_PASSWORD=your_secure_password_here
