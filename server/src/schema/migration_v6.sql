-- v6: how each subscription is cancelled. 'email' asks the merchant; 'card' (later) closes its card.
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS rail TEXT NOT NULL DEFAULT 'email';

DO $$ BEGIN
  ALTER TABLE subscriptions
    ADD CONSTRAINT subscriptions_rail_check CHECK (rail IN ('email','card'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
