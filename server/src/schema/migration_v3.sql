-- Migration v3: reminders table
-- Run with: psql "$NEON_DATABASE_URL" -f src/schema/migration_v3.sql

CREATE TABLE IF NOT EXISTS reminders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL DEFAULT 'renewal'
                  CHECK (type IN ('renewal', 'review', 'trial_end', 'custom')),
  remind_at       TIMESTAMPTZ NOT NULL,
  sent_at         TIMESTAMPTZ,
  user_email      TEXT,
  message         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at) WHERE sent_at IS NULL;
