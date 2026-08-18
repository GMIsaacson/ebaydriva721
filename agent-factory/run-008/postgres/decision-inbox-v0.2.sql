-- Run 008 — Durable Decision & Approval Inbox v0.2
-- Forward migration from operations-core-v0.1.sql.

ALTER TABLE ops_core_decisions ADD COLUMN IF NOT EXISTS decision_key text;
ALTER TABLE ops_core_decisions ADD COLUMN IF NOT EXISTS producer_id text;
ALTER TABLE ops_core_decisions ADD COLUMN IF NOT EXISTS decision_type text;
ALTER TABLE ops_core_decisions ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE ops_core_decisions ADD COLUMN IF NOT EXISTS recommendation text;
ALTER TABLE ops_core_decisions ADD COLUMN IF NOT EXISTS severity text;
ALTER TABLE ops_core_decisions ADD COLUMN IF NOT EXISTS deadline_at timestamptz;
ALTER TABLE ops_core_decisions ADD COLUMN IF NOT EXISTS estimated_cost_cents integer NOT NULL DEFAULT 0;
ALTER TABLE ops_core_decisions ADD COLUMN IF NOT EXISTS evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
  ALTER TABLE ops_core_decisions ADD CONSTRAINT ops_core_decisions_severity_check
    CHECK (severity IS NULL OR severity IN ('INFO','ATTENTION','URGENT'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE ops_core_decisions ADD CONSTRAINT ops_core_decisions_estimated_cost_check
    CHECK (estimated_cost_cents >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_ops_core_decisions_decision_key
  ON ops_core_decisions(decision_key) WHERE decision_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ops_core_decisions_owner_queue
  ON ops_core_decisions(status, severity, deadline_at, estimated_cost_cents DESC);

CREATE OR REPLACE VIEW ops_core_owner_decision_inbox AS
SELECT
  decision_id,
  decision_key,
  producer_id,
  subject_id,
  decision_type,
  subject,
  reason,
  recommendation,
  authority_required,
  severity,
  status,
  deadline_at,
  estimated_cost_cents,
  evidence_refs,
  created_from_event_id,
  created_at,
  updated_at,
  CASE
    WHEN status <> 'OPEN' THEN 'CLOSED'
    WHEN deadline_at IS NOT NULL AND deadline_at < now() THEN 'OVERDUE'
    WHEN severity = 'URGENT' THEN 'URGENT_NOW'
    WHEN authority_required IN ('OWNER_APPROVAL','COST_APPROVAL','EXTERNAL_ACTION_APPROVAL') THEN 'NEEDS_MY_APPROVAL'
    ELSE 'CAN_WAIT'
  END AS owner_bucket,
  CASE severity WHEN 'URGENT' THEN 3 WHEN 'ATTENTION' THEN 2 ELSE 1 END AS severity_rank
FROM ops_core_decisions;

CREATE OR REPLACE VIEW ops_core_owner_open_decisions AS
SELECT *
FROM ops_core_owner_decision_inbox
WHERE status = 'OPEN'
ORDER BY
  CASE owner_bucket
    WHEN 'OVERDUE' THEN 1
    WHEN 'URGENT_NOW' THEN 2
    WHEN 'NEEDS_MY_APPROVAL' THEN 3
    WHEN 'CAN_WAIT' THEN 4
    ELSE 5
  END,
  severity_rank DESC,
  deadline_at NULLS LAST,
  estimated_cost_cents DESC,
  created_at ASC;
