-- Migration v2: attestation fields on actions table
-- Run with: psql "$NEON_DATABASE_URL" -f src/schema/migration_v2.sql

ALTER TABLE actions ADD COLUMN IF NOT EXISTS signature   TEXT;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS agent_address TEXT;
ALTER TABLE actions ADD COLUMN IF NOT EXISTS metadata    JSONB NOT NULL DEFAULT '{}';

-- Track SELF Protocol verification per user
ALTER TABLE users ADD COLUMN IF NOT EXISTS self_verified   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS self_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS policy_granted   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS policy_granted_at TIMESTAMPTZ;
