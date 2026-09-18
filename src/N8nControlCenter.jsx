import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthProvider";
import { controlWorkflow, fetchN8nSnapshot, fetchWorkflowResult } from "./n8nControlApi";
import "./n8n-control.css";

function fmtTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(date);
}

function fmtDuration(ms) {
  if (!Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

function Status({ value }) {
  const label = String(value || "unknown").toLowerCase();
  return <span className={`n8nc-status n8nc-status-${label}`}>{label}</span>;
}

function Metric({ value, label, note }) {
  return (
    <div className="n8nc-metric">
      <strong>{value ?? "—"}</strong>
      <span>{label}</span>
      {note && <small>{note}</small>}
    </div>
  );
}

function Empty({ title, children }) {
  return (
    <div className="n8nc-empty">
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

export default function N8nControlCenter() {
  const { currentUser } = useAuth();
  const [snapshot, setSnapshot] = useState(null);
  const [section, setSection] = useState("overview");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const [resultView, setResultView] = useState(null);

  const refresh = async ({ quiet = false } = {}) => {
    if (!currentUser) return;
    if (!quiet) setLoading(true);
    try {
      const data = await fetchN8nSnapshot(currentUser);
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError({ message: err.message, status: err.status, payload: err.payload || {} });
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => refresh({ quiet: true }), 30_000);
    return () => window.clearInterval(timer);
  }, [currentUser]);

  const workflows = snapshot?.workflows || [];
  const executions = snapshot?.executions || [];
  const needle = query.trim().toLowerCase();

  const filteredWorkflows = useMemo(() => {
    if (!needle) return workflows;
    return workflows.filter((row) =>
      [row.name, row.id, row.schedule, row.operationalState]
        .join(" ").toLowerCase().includes(needle)
    );
  }, [workflows, needle]);

  const filteredExecutions = useMemo(() => {
    if (!needle) return executions;
    return executions.filter((row) =>
      [row.workflowName, row.workflowId, row.id, row.status, row.mode]
        .join(" ").toLowerCase().includes(needle)
    );
  }, [executions, needle]);

  const failures = useMemo(
    () => filteredWorkflows.filter((row) => Number(row.errors24h || 0) > 0),
    [filteredWorkflows]
  );

  const scheduled = useMemo(
    () => filteredWorkflows.filter((row) => row.scheduled),
    [filteredWorkflows]
  );

  const running = useMemo(
    () => filteredExecutions.filter((row) => String(row.status).toLowerCase() === "running"),
    [filteredExecutions]
  );

  const handleControl = async (workflow, action) => {
    if (!snapshot?.writeEnabled || busyId) return;
    const verb = action === "pause" ? "Pause" : action === "resume" ? "Resume" : "Restart";
    if (!window.confirm(`${verb} ${workflow.name}?\n\nThis changes the live n8n workflow state.`)) return;

    setBusyId(workflow.id);
    setNotice("");
    try {
      await controlWorkflow(currentUser, workflow.id, action);
      setNotice(`${workflow.name}: ${action} completed.`);
      await refresh({ quiet: true });
    } catch (err) {
      setNotice(`Control failed: ${err.message}`);
    } finally {
      setBusyId("");
    }
  };

  const openResult = async (workflow) => {
    setResultView({ workflow, loading: true, payload: null, error: null });
    try {
      const payload = await fetchWorkflowResult(currentUser, workflow.id);
      setResultView({ workflow, loading: false, payload, error: null });
    } catch (err) {
      setResultView({ workflow, loading: false, payload: null, error: err.message });
    }
  };

  const nav = [
    ["overview", "Overview"],
    ["workflows", "Workflows"],
    ["executions", "Executions"],
    ["failures", "Failures"],
    ["schedules", "Schedules"],
  ];

  const visibleCount = section === "workflows"
    ? filteredWorkflows.length
    : section === "failures"
      ? failures.length
      : section === "schedules"
        ? scheduled.length
        : filteredExecutions.length;

  return (
    <div className="n8nc-page">
      <aside className="n8nc-sidebar">
        <div className="n8nc-brand">
          <div className="n8nc-mark">n8n</div>
          <div><strong>Control Center</strong><span>Factory orchestration</span></div>
        </div>

        <nav>
          {nav.map(([key, label]) => (
            <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}>
              <span>{label}</span>
              {key === "failures" && failures.length > 0 && <b>{failures.length}</b>}
            </button>
          ))}
        </nav>

        <div className="n8nc-side-health">
          <i className={snapshot?.connected ? "live" : error ? "down" : "checking"} />
          <div>
            <strong>{snapshot?.connected ? "Factory n8n live" : error ? "Connection problem" : "Checking n8n"}</strong>
            <span>{snapshot?.connected ? "Private n8n · server-side telemetry" : "No n8n secret exposed to browser"}</span>
          </div>
        </div>
      </aside>

      <main className="n8nc-main">
        <header className="n8nc-header">
          <div>
            <div className="n8nc-eyebrow">FACTORY · ORCHESTRATION CONTROL PLANE</div>
            <h1>n8n Control Center</h1>
            <p>See workflow state, analyze recent outcomes, isolate failures and control managed automation from one surface.</p>
          </div>
          <div className="n8nc-header-actions">
            {snapshot?.sourceUiUrl && (
              <a href={snapshot.sourceUiUrl} target="_blank" rel="noreferrer">Open server console ↗</a>
            )}
            <button onClick={() => refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
          </div>
        </header>

        <div className="n8nc-control-strip">
          <div>
            <span className={snapshot?.connected ? "n8nc-dot live" : "n8nc-dot"} />
            <strong>{snapshot?.connected ? "Live telemetry" : "Telemetry offline"}</strong>
            <small>{snapshot?.fetchedAt ? `Updated ${fmtTime(snapshot.fetchedAt)} · auto-refresh 30s` : "Waiting for first successful read"}</small>
          </div>
          <div>
            <strong>{snapshot?.writeEnabled ? "Owner controls enabled" : "Owner controls locked"}</strong>
            <small>{snapshot?.writeEnabled ? "Pause / resume / restart are authorized and audited." : "Telemetry is live; mutations remain gated."}</small>
          </div>
          {snapshot?.coverage?.managed != null && (
            <span className="n8nc-warning">{snapshot.coverage.managed} Factory-managed workflows in this live scope</span>
          )}
        </div>

        {notice && <div className={notice.startsWith("Control failed") ? "n8nc-notice error" : "n8nc-notice"}>{notice}</div>}

        {error && !snapshot?.connected && (
          <section className="n8nc-setup">
            <div className="n8nc-setup-copy">
              <span>LIVE BACKEND</span>
              <h2>Factory workflow service is not reachable</h2>
              <p>
                n8n itself stays private on localhost. This cockpit reads through the Factory workflow service instead of exposing port 5678.
              </p>
            </div>
            <div className="n8nc-env-grid">
              <code>WORKFLOW_CONTROL_BASE_URL</code><span>Optional override for the Factory workflow service</span>
              <code>N8N_CONTROL_OWNER_UID / EMAIL</code><span>Owner identity gate for lifecycle actions</span>
              <code>WORKFLOW_CONTROL_USER / PASSWORD</code><span>Server-side credentials for mutation requests only</span>
            </div>
            <small>Current gateway response: {error.message}</small>
          </section>
        )}

        {!error && snapshot?.connected && !snapshot?.writeEnabled && (
          <section className="n8nc-readonly-note">
            <strong>Live read mode is operational.</strong>
            <span>Owner lifecycle controls are intentionally disabled until the Vercel owner gate and workflow-control credentials are configured.</span>
          </section>
        )}

        <section className="n8nc-metrics">
          <Metric value={snapshot?.metrics?.workflows} label="Managed workflows" />
          <Metric value={snapshot?.metrics?.activeWorkflows} label="Active" />
          <Metric value={snapshot?.metrics?.scheduledWorkflows} label="Scheduled" />
          <Metric value={snapshot?.metrics?.executions24h} label="Executions · 24h" />
          <Metric value={snapshot?.metrics?.failures24h} label="Errors · 24h" />
          <Metric
            value={snapshot?.metrics?.successRate24h == null ? "—" : `${snapshot.metrics.successRate24h}%`}
            label="Success rate · 24h"
          />
        </section>

        <div className="n8nc-toolbar">
          <div className="n8nc-search">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workflow, schedule or state" />
          </div>
          <span>{visibleCount} visible</span>
        </div>

        {section === "overview" && (
          <>
            <section className="n8nc-grid n8nc-overview-grid">
              <article className="n8nc-panel">
                <div className="n8nc-panel-head">
                  <div><span>RUNNING NOW</span><h2>Live executions</h2></div>
                  <b>{snapshot?.metrics?.running || 0}</b>
                </div>
                <div className="n8nc-list">
                  {running.slice(0, 8).map((row) => (
                    <div key={row.id}>
                      <div><strong>{row.workflowName}</strong><span>Execution {row.id} · {fmtTime(row.startedAt)}</span></div>
                      <Status value={row.status} />
                    </div>
                  ))}
                  {!running.length && <Empty title="Nothing running now">No managed workflow is executing at this instant.</Empty>}
                </div>
              </article>

              <article className="n8nc-panel">
                <div className="n8nc-panel-head">
                  <div><span>FAILURE RADAR</span><h2>Errors in the last 24 hours</h2></div>
                  <b>{snapshot?.metrics?.failures24h || 0}</b>
                </div>
                <div className="n8nc-list">
                  {failures.slice(0, 6).map((workflow) => (
                    <div key={workflow.id}>
                      <div><strong>{workflow.name}</strong><span>{workflow.schedule}</span></div>
                      <em>{workflow.errors24h} error{workflow.errors24h === 1 ? "" : "s"}</em>
                    </div>
                  ))}
                  {!failures.length && <Empty title="No managed-workflow errors">The live backend reports zero errors in the current 24-hour window.</Empty>}
                </div>
              </article>
            </section>

            <section className="n8nc-panel n8nc-recent">
              <div className="n8nc-panel-head">
                <div><span>LATEST BY WORKFLOW</span><h2>Most recent executions</h2></div>
                <button className="n8nc-text-button" onClick={() => setSection("executions")}>View all →</button>
              </div>
              <ExecutionTable rows={filteredExecutions} />
            </section>
          </>
        )}

        {section === "workflows" && (
          <section className="n8nc-panel">
            <div className="n8nc-panel-head">
              <div><span>MANAGED WORKFLOW INVENTORY</span><h2>Factory automations</h2></div>
              <small>{snapshot?.writeEnabled ? "Owner controls active" : "Control actions are read-only here for now"}</small>
            </div>
            <div className="n8nc-table-wrap">
              <table>
                <thead><tr><th>Workflow</th><th>Schedule</th><th>Latest run</th><th>Errors 24h</th><th>State</th><th>Control</th></tr></thead>
                <tbody>
                  {filteredWorkflows.map((workflow) => {
                    const paused = workflow.operationalState === "paused";
                    return (
                      <tr key={workflow.id}>
                        <td><strong>{workflow.name}</strong><small>{workflow.id}</small></td>
                        <td>{workflow.schedule}</td>
                        <td>{workflow.latestExecution ? `${workflow.latestExecution.status} · ${fmtTime(workflow.latestExecution.startedAt)}` : "—"}</td>
                        <td>{workflow.errors24h || 0}</td>
                        <td><Status value={workflow.operationalState} /></td>
                        <td>
                          <div className="n8nc-row-actions">
                            <button onClick={() => openResult(workflow)}>Result</button>
                            <button
                              disabled={!snapshot?.writeEnabled || busyId === workflow.id}
                              onClick={() => handleControl(workflow, paused ? "resume" : "pause")}
                              title={!snapshot?.writeEnabled ? "Owner lifecycle controls are not configured" : paused ? "Resume workflow" : "Pause workflow"}
                            >
                              {busyId === workflow.id ? "Working…" : paused ? "Resume" : "Pause"}
                            </button>
                            <button
                              disabled={!snapshot?.writeEnabled || busyId === workflow.id}
                              onClick={() => handleControl(workflow, "restart")}
                              title={!snapshot?.writeEnabled ? "Owner lifecycle controls are not configured" : "Restart workflow registration/runtime"}
                            >
                              Restart
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!filteredWorkflows.length && <Empty title="No workflows found">Adjust the search or refresh the live backend.</Empty>}
          </section>
        )}

        {section === "executions" && (
          <section className="n8nc-panel">
            <div className="n8nc-panel-head">
              <div><span>LATEST EXECUTION SNAPSHOT</span><h2>Latest run for each managed workflow</h2></div>
              <small>Execution payloads load only when you request a result.</small>
            </div>
            <ExecutionTable rows={filteredExecutions} />
            {!filteredExecutions.length && <Empty title="No execution records">No managed workflow has a latest execution in the live snapshot.</Empty>}
          </section>
        )}

        {section === "failures" && (
          <section className="n8nc-panel">
            <div className="n8nc-panel-head">
              <div><span>FAILURE QUEUE</span><h2>Managed workflows needing attention</h2></div>
              <b>{failures.length}</b>
            </div>
            <div className="n8nc-list">
              {failures.map((workflow) => (
                <div key={workflow.id}>
                  <div><strong>{workflow.name}</strong><span>{workflow.schedule} · latest {fmtTime(workflow.latestExecution?.startedAt)}</span></div>
                  <div className="n8nc-row-actions"><em>{workflow.errors24h} errors</em><button onClick={() => openResult(workflow)}>View result</button></div>
                </div>
              ))}
            </div>
            {!failures.length && <Empty title="No failures found">The live backend reports zero errors for managed workflows in the last 24 hours.</Empty>}
          </section>
        )}

        {section === "schedules" && (
          <section className="n8nc-panel">
            <div className="n8nc-panel-head">
              <div><span>SCHEDULE INVENTORY</span><h2>Scheduled Factory workflows</h2></div>
              <b>{scheduled.length}</b>
            </div>
            <div className="n8nc-schedule-grid">
              {scheduled.map((workflow) => (
                <article key={workflow.id}>
                  <div><Status value={workflow.operationalState} /><span>{workflow.schedule}</span></div>
                  <h3>{workflow.name}</h3>
                  <p>{workflow.latestCompleted ? `Last completed ${fmtTime(workflow.latestCompleted.stoppedAt)} · ${fmtDuration(workflow.latestCompleted.durationMs)}` : "No completed run in live snapshot"}</p>
                  <button className="n8nc-text-button" onClick={() => openResult(workflow)}>View latest result →</button>
                </article>
              ))}
            </div>
            {!scheduled.length && <Empty title="No scheduled workflows found">No managed workflow currently reports a schedule.</Empty>}
          </section>
        )}

        <footer className="n8nc-footer">
          <span>n8n stays private on localhost · Vercel is the authenticated operator cockpit.</span>
          <span>Telemetry: Factory workflow service · Mutations: owner-gated + server authenticated</span>
        </footer>
      </main>

      {resultView && (
        <div className="n8nc-result-modal" onMouseDown={(event) => { if (event.target === event.currentTarget) setResultView(null); }}>
          <section>
            <div className="n8nc-result-head">
              <div>
                <span>LATEST USEFUL RESULT</span>
                <h2>{resultView.workflow.name}</h2>
                <small>{resultView.payload?.node || resultView.workflow.id}{resultView.payload?.execution?.id ? ` · execution ${resultView.payload.execution.id}` : ""}</small>
              </div>
              <button onClick={() => setResultView(null)}>Close</button>
            </div>
            {resultView.loading && <div className="n8nc-result-body">Loading result…</div>}
            {resultView.error && <div className="n8nc-result-error">{resultView.error}</div>}
            {!resultView.loading && !resultView.error && (
              <pre className="n8nc-result-body">
                {resultView.payload?.payload == null
                  ? (resultView.payload?.message || "No stored result payload.")
                  : JSON.stringify(resultView.payload.payload, null, 2)}
              </pre>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ExecutionTable({ rows }) {
  if (!rows.length) return null;
  return (
    <div className="n8nc-table-wrap">
      <table>
        <thead><tr><th>Execution</th><th>Workflow</th><th>Status</th><th>Trigger / schedule</th><th>Started</th><th>Duration</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><strong>#{row.id}</strong></td>
              <td><strong>{row.workflowName}</strong><small>{row.workflowId || "—"}</small></td>
              <td><Status value={row.status} /></td>
              <td>{row.mode || "—"}</td>
              <td>{fmtTime(row.startedAt)}</td>
              <td>{fmtDuration(row.durationMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
