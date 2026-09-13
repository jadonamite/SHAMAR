-- Migration v5: ERC-8004 agent identity columns
-- Run in Neon SQL editor: https://console.neon.tech

-- Agent action audit columns (actions table was created without these)
ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS signature     TEXT,
  ADD COLUMN IF NOT EXISTS agent_address TEXT,
  ADD COLUMN IF NOT EXISTS metadata      JSONB;

-- User onchain identity flags
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS self_verified     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS self_verified_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS policy_granted    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS policy_granted_at TIMESTAMPTZ;
