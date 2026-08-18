BEGIN;

CREATE TABLE IF NOT EXISTS run006_subscription_evidence_stage (
  evidence_id text PRIMARY KEY,
  source_type text NOT NULL CHECK (source_type = 'Gmail'),
  source_ref text NOT NULL,
  message_id text NOT NULL UNIQUE,
  thread_id text,
  observed_at timestamptz NOT NULL,
  sender text,
  subject text,
  snippet varchar(500),
  evidence_link text,
  connector_trust text NOT NULL DEFAULT 'candidate' CHECK (connector_trust IN ('candidate','verified','untrusted')),
  raw_body_retained boolean NOT NULL DEFAULT false CHECK (raw_body_retained = false),
  staged_at timestamptz NOT NULL DEFAULT now(),
  reconciled_at timestamptz
);

CREATE INDEX IF NOT EXISTS run006_subscription_evidence_stage_observed_idx
  ON run006_subscription_evidence_stage (observed_at DESC);

CREATE TABLE IF NOT EXISTS run006_subscription_register_outbox (
  outbox_id bigserial PRIMARY KEY,
  dedupe_key text NOT NULL,
  action text NOT NULL CHECK (action IN ('CREATE','UPDATE')),
  notion_page_id text,
  subscription_title text NOT NULL,
  vendor text NOT NULL,
  product_plan text NOT NULL,
  account_email text,
  status text NOT NULL,
  amount_cents integer CHECK (amount_cents IS NULL OR amount_cents >= 0),
  currency char(3) NOT NULL,
  billing_cycle text NOT NULL,
  monthly_equivalent_cents integer CHECK (monthly_equivalent_cents IS NULL OR monthly_equivalent_cents >= 0),
  renewal_date date,
  cancellation_deadline date,
  auto_renew boolean NOT NULL DEFAULT false,
  payment_source_label text,
  usage_state text NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('High','Medium','Low')),
  human_review_needed boolean NOT NULL,
  evidence_link text,
  validated_by text NOT NULL DEFAULT 'SUB-OPS-RUNTIME-006',
  validation_hash text NOT NULL,
  state text NOT NULL DEFAULT 'READY' CHECK (state IN ('READY','COMMITTED','REVIEW','FAILED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz,
  UNIQUE (dedupe_key, validation_hash)
);

CREATE INDEX IF NOT EXISTS run006_subscription_register_outbox_ready_idx
  ON run006_subscription_register_outbox (state, created_at)
  WHERE state = 'READY';

COMMIT;
