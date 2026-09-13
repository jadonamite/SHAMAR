-- Phase 8: User-defined policy engine
CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL,        -- 'trial_cancel' | 'spend_alert' | 'inactivity_pause'
  conditions JSONB NOT NULL DEFAULT '{}',
  action TEXT NOT NULL,         -- 'cancel' | 'pause' | 'remind' | 'alert'
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_evaluated_at TIMESTAMPTZ,
  last_triggered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS policies_user_id_idx ON policies(user_id);
CREATE INDEX IF NOT EXISTS policies_enabled_idx ON policies(enabled) WHERE enabled = true;

-- Track which subscriptions a policy has already acted on (avoid re-firing)
CREATE TABLE IF NOT EXISTS policy_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  fired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL,
  UNIQUE(policy_id, subscription_id)
);
