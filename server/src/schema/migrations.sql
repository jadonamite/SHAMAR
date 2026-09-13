-- SAM Database Schema
-- Run against Neon PostgreSQL

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_did    TEXT NOT NULL UNIQUE,
  wallet_address TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS signals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  type             TEXT NOT NULL,
  value            TEXT NOT NULL,
  weight           NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  action           TEXT NOT NULL CHECK (action IN ('cancel','pause','remind','keep')),
  confidence       INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  evidence         JSONB NOT NULL DEFAULT '[]',
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','dismissed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS actions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  type             TEXT NOT NULL,
  triggered_by     TEXT NOT NULL CHECK (triggered_by IN ('user','policy')),
  executed_at      TIMESTAMPTZ,
  reversible       BOOLEAN NOT NULL DEFAULT true,
  reversed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_signals_subscription_id ON signals(subscription_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_subscription_id ON recommendations(subscription_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_actions_subscription_id ON actions(subscription_id);
