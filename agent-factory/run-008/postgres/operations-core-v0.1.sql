-- Run 008 — Operations Core v0.1
-- Shared storage primitives for evidence-driven, governed operations.

CREATE TABLE IF NOT EXISTS ops_core_sources (
  source_id text PRIMARY KEY,
  source_type text NOT NULL,
  owner_scope text NOT NULL,
  connection_state text NOT NULL CHECK (connection_state IN ('PENDING','CONNECTED','DEGRADED','DISCONNECTED','RETIRED')),
  authority_mode text NOT NULL CHECK (authority_mode IN ('READ_ONLY','INTERNAL_WRITE','EXTERNAL_WRITE_GATED')),
  credential_ref text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops_core_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  producer_id text NOT NULL,
  subject_id text NOT NULL,
  source_id text NULL REFERENCES ops_core_sources(source_id),
  occurred_at timestamptz NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  provenance text NOT NULL CHECK (provenance IN ('DIRECT','DERIVED','HUMAN_SUPPLIED')),
  payload_class text NOT NULL CHECK (payload_class IN ('MINIMAL','STANDARD','SENSITIVE')),
  integrity_key text NOT NULL,
  idempotency_key text NOT NULL,
  correlation_id text NULL,
  causation_id text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (producer_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_ops_core_events_subject_time ON ops_core_events(subject_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_core_events_correlation ON ops_core_events(correlation_id);

CREATE TABLE IF NOT EXISTS ops_core_decisions (
  decision_id text PRIMARY KEY,
  subject_id text NOT NULL,
  reason text NOT NULL,
  authority_required text NOT NULL CHECK (authority_required IN ('NONE','INTERNAL_WRITE','OWNER_APPROVAL','COST_APPROVAL','EXTERNAL_ACTION_APPROVAL')),
  status text NOT NULL CHECK (status IN ('OPEN','APPROVED','REJECTED','EXPIRED','RESOLVED')),
  created_from_event_id text NULL REFERENCES ops_core_events(event_id),
  expires_at timestamptz NULL,
  resolution jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops_core_notifications (
  notification_id bigserial PRIMARY KEY,
  incident_key text NOT NULL,
  subject_id text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('INFO','ATTENTION','URGENT')),
  channel_class text NOT NULL CHECK (channel_class IN ('SILENT','BRIEF','IMMEDIATE')),
  cooldown_key text NOT NULL,
  human_review_needed boolean NOT NULL DEFAULT false,
  state text NOT NULL DEFAULT 'READY' CHECK (state IN ('READY','SUPPRESSED','SENT','FAILED','CANCELLED')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL,
  UNIQUE (incident_key, validation_hash)
);

CREATE TABLE IF NOT EXISTS ops_core_heartbeats (
  watcher_id text PRIMARY KEY,
  emitted_at timestamptz NOT NULL,
  expected_cadence_seconds integer NOT NULL CHECK (expected_cadence_seconds > 0),
  tolerance_seconds integer NOT NULL DEFAULT 0 CHECK (tolerance_seconds >= 0),
  status text NOT NULL CHECK (status IN ('HEALTHY','STALE','DEGRADED','FAILED')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops_core_cost_events (
  cost_event_id text PRIMARY KEY,
  service text NOT NULL,
  subject_id text NOT NULL,
  estimated_cents integer NOT NULL CHECK (estimated_cents >= 0),
  approved_ceiling_cents integer NOT NULL CHECK (approved_ceiling_cents >= 0),
  actual_cents integer NULL CHECK (actual_cents IS NULL OR actual_cents >= 0),
  approval_state text NOT NULL CHECK (approval_state IN ('NOT_REQUIRED','PENDING','APPROVED','REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops_core_dependencies (
  dependency_id text PRIMARY KEY,
  subject_id text NOT NULL,
  depends_on_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('OPEN','BLOCKED','SATISFIED','WAIVED')),
  reason text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subject_id, depends_on_id)
);

CREATE TABLE IF NOT EXISTS ops_core_action_ledger (
  action_id text PRIMARY KEY,
  subject_id text NOT NULL,
  action_type text NOT NULL,
  authority_required text NOT NULL,
  approval_ref text NULL,
  idempotency_key text NOT NULL UNIQUE,
  cost_ceiling_cents integer NOT NULL DEFAULT 0 CHECK (cost_ceiling_cents >= 0),
  state text NOT NULL CHECK (state IN ('PLANNED','AUTHORIZED','EXECUTING','COMMITTED','FAILED','CANCELLED')),
  request_hash text NOT NULL,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
