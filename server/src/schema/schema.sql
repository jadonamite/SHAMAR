-- SHAMAR Consolidated Database Schema
-- Run against Neon PostgreSQL

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users: Web3 / Privy / MiniPay identity and agent grant state
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_did         TEXT NOT NULL UNIQUE,
  wallet_address    TEXT,
  email             TEXT,
  telegram_chat_id  TEXT,
  self_verified     BOOLEAN NOT NULL DEFAULT false,
  self_verified_at  TIMESTAMPTZ,
  policy_granted    BOOLEAN NOT NULL DEFAULT false,
  policy_granted_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subscriptions: Detected recurring charges (Gmail or wallet)
CREATE TABLE IF NOT EXISTS subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  merchant     TEXT NOT NULL,
  amount       NUMERIC(10, 2) NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'USD',
  cadence      TEXT NOT NULL CHECK (cadence IN ('daily','weekly','monthly','yearly')),
  source       TEXT NOT NULL CHECK (source IN ('gmail','wallet')),
  category     TEXT,
  detected_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_charged TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Signals: Per-receipt and transaction evidence for subscriptions
CREATE TABLE IF NOT EXISTS signals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  type             TEXT NOT NULL,
  value            TEXT NOT NULL,
  weight           NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
  message_id       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recommendations: Agent decisions with full blast radius and confidence
CREATE TABLE IF NOT EXISTS recommendations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  action           TEXT NOT NULL CHECK (action IN ('cancel','pause','remind','keep')),
  confidence       INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  evidence         JSONB NOT NULL DEFAULT '[]',
  decision         JSONB,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','dismissed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Actions: Audited, cryptographically signed agent actions (EIP-191)
CREATE TABLE IF NOT EXISTS actions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  type             TEXT NOT NULL,
  triggered_by     TEXT NOT NULL CHECK (triggered_by IN ('user','policy')),
  executed_at      TIMESTAMPTZ,
  reversible       BOOLEAN NOT NULL DEFAULT true,
  reversed_at      TIMESTAMPTZ,
  signature        TEXT,
  agent_address    TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reminders: Scheduled email notifications
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

-- Policies: User-defined automation rules
CREATE TABLE IF NOT EXISTS policies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  trigger           TEXT NOT NULL,
  conditions        JSONB NOT NULL DEFAULT '{}',
  action            TEXT NOT NULL,
  enabled           BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_evaluated_at TIMESTAMPTZ,
  last_triggered_at TIMESTAMPTZ
);

-- Policy Events: Deduplication record of which policy acted on which subscription
CREATE TABLE IF NOT EXISTS policy_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id       UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  fired_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  action          TEXT NOT NULL,
  UNIQUE(policy_id, subscription_id)
);

-- KV Store: Redis-compatible caching, locks, tokens, Telegram state
CREATE TABLE IF NOT EXISTS kv (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_privy_did ON users(privy_did);
CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON users(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_signals_subscription_id ON signals(subscription_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_signals_sub_message ON signals(subscription_id, message_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_subscription_id ON recommendations(subscription_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_actions_subscription_id ON actions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_policies_user_id ON policies(user_id);
CREATE INDEX IF NOT EXISTS idx_policies_enabled ON policies(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_kv_expires_at ON kv(expires_at);
