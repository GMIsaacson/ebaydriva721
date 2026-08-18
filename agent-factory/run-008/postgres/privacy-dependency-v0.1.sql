-- Run 008 — privacy/retention + dependency/blocker extension

ALTER TABLE ops_core_events
  ADD COLUMN IF NOT EXISTS retention_class text NULL CHECK (retention_class IN ('PUBLIC','INTERNAL','SENSITIVE','SECRET')),
  ADD COLUMN IF NOT EXISTS purge_after timestamptz NULL;

ALTER TABLE ops_core_dependencies
  ADD COLUMN IF NOT EXISTS owner text NULL,
  ADD COLUMN IF NOT EXISTS expected_by timestamptz NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ops_core_events_purge_after
  ON ops_core_events(purge_after)
  WHERE purge_after IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ops_core_dependencies_state_due
  ON ops_core_dependencies(state, expected_by);

CREATE OR REPLACE VIEW ops_core_blocker_view AS
SELECT
  dependency_id,
  subject_id,
  depends_on_id,
  state,
  reason,
  owner,
  expected_by,
  updated_at,
  CASE
    WHEN state IN ('SATISFIED','WAIVED') THEN 'CLEAR'
    WHEN expected_by IS NOT NULL AND expected_by < now() THEN 'OVERDUE'
    WHEN state = 'BLOCKED' THEN 'BLOCKED'
    WHEN updated_at < now() - interval '72 hours' THEN 'STALE'
    ELSE 'OPEN'
  END AS attention_state
FROM ops_core_dependencies;
