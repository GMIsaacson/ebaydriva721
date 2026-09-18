import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthProvider";
import { fetchN8nSnapshot, setWorkflowActive } from "./n8nControlApi";
import "./n8n-control.css";

const FAIL_STATES = new Set(["error", "crashed", "canceled"]);

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
      [row.name, row.id, ...(row.tags || []), ...(row.triggers || [])]
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
    () => filteredExecutions.filter((row) => FAIL_STATES.has(String(row.status).toLowerCase())),
    [filteredExecutions]
  );

  const scheduled = useMemo(
    () => filteredWorkflows.filter((row) => (row.triggers || []).includes("Schedule")),
    [filteredWorkflows]
  );

  const failureGroups = useMemo(() => {
    const groups = new Map();
    for (const row of failures) {
      const key = row.workflowId || row.workflowName;
      const item = groups.get(key) || {
        workflowId: row.workflowId,
        workflowName: row.workflowName,
        count: 0,
        latest: null,
      };
      item.count += 1;
      if (!item.latest || Date.parse(row.startedAt || 0) > Date.parse(item.latest.startedAt || 0)) {
        item.latest = row;
      }
      groups.set(key, item);
    }
    return Array.from(groups.values()).sort((a, b) => b.count - a.count);
  }, [failures]);

  const handleToggle = async (workflow) => {
    if (!snapshot?.writeEnabled || busyId) return;
    setBusyId(workflow.id);
    setNotice("");
    try {
      await setWorkflowActive(currentUser, workflow.id, !workflow.active);
      setNotice(`${workflow.name} ${workflow.active ? "deactivated" : "activated"}.`);
      await refresh({ quiet: true });
    } catch (err) {
      setNotice(`Control failed: ${err.message}`);
    } finally {
      setBusyId("");
    }
  };

  const nav = [
    ["overview", "Overview"],
    ["workflows", "Workflows"],
    ["executions", "Executions"],
    ["failures", "Failures"],
    ["schedules", "Schedules"],
  ];

  const configured = snapshot?.configured !== false && error?.payload?.configured !== false;

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
            <strong>{snapshot?.connected ? "n8n connected" : error ? "Connection needs setup" : "Checking n8n"}</strong>
            <span>{snapshot?.connected ? "Server-side API bridge" : "No credentials exposed to browser"}</span>
          </div>
        </div>
      </aside>

      <main className="n8nc-main">
        <header className="n8nc-header">
          <div>
            <div className="n8nc-eyebrow">FACTORY · ORCHESTRATION CONTROL PLANE</div>
            <h1>n8n Control Center</h1>
            <p>See workflow state, analyze executions, isolate failures and control publication from one surface.</p>
          </div>
          <div className="n8nc-header-actions">
            {snapshot?.instanceUrl && (
              <a href={snapshot.instanceUrl} target="_blank" rel="noreferrer">Open n8n ↗</a>
            )}
            <button onClick={() => refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
          </div>
        </header>

        <div className="n8nc-control-strip">
          <div>
            <span className={snapshot?.connected ? "n8nc-dot live" : "n8nc-dot"} />
            <strong>{snapshot?.connected ? "Live telemetry" : "Telemetry offline"}</strong>
            <small>{snapshot?.fetchedAt ? `Updated ${fmtTime(snapshot.fetchedAt)} · auto-refresh 30s` : "Waiting for first successful API read"}</small>
          </div>
          <div>
            <strong>{snapshot?.writeEnabled ? "Owner controls enabled" : "Owner controls locked"}</strong>
            <small>{snapshot?.writeEnabled ? "Activate / deactivate actions are authorized and audited." : "Reads remain isolated; workflow writes require the owner gate."}</small>
          </div>
          {snapshot?.sampleTruncated && <span className="n8nc-warning">View is capped to the newest 500 records.</span>}
        </div>

        {notice && <div className={notice.startsWith("Control failed") ? "n8nc-notice error" : "n8nc-notice"}>{notice}</div>}

        {error && !snapshot?.connected && (
          <section className="n8nc-setup">
            <div className="n8nc-setup-copy">
              <span>CONNECTION SETUP</span>
              <h2>{configured ? "n8n is not reachable yet" : "Connect this cockpit to n8n"}</h2>
              <p>
                The UI is deployed with a server-side gateway. It needs the self-hosted n8n URL and API key in Vercel;
                the key never reaches the browser.
              </p>
            </div>
            <div className="n8nc-env-grid">
              <code>N8N_BASE_URL</code><span>Public HTTPS URL for the n8n instance</span>
              <code>N8N_API_KEY</code><span>API key from n8n Settings → n8n API</span>
              <code>N8N_CONTROL_OWNER_UID</code><span>Firebase UID allowed to activate/deactivate workflows</span>
              <code>N8N_CONTROL_OWNER_EMAIL</code><span>Alternative owner gate if UID is not used</span>
            </div>
            <small>Current gateway response: {error.message}</small>
          </section>
        )}

        <section className="n8nc-metrics">
          <Metric value={snapshot?.metrics?.workflows} label="Workflows" />
          <Metric value={snapshot?.metrics?.activeWorkflows} label="Active" />
          <Metric value={snapshot?.metrics?.scheduledWorkflows} label="Scheduled" />
          <Metric value={snapshot?.metrics?.executions24h} label="Executions · 24h" />
          <Metric value={snapshot?.metrics?.failures24h} label="Failures · 24h" />
          <Metric
            value={snapshot?.metrics?.successRate24h == null ? "—" : `${snapshot.metrics.successRate24h}%`}
            label="Success rate · 24h"
          />
        </section>

        <div className="n8nc-toolbar">
          <div className="n8nc-search">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workflow, execution, tag or status" />
          </div>
          <span>{section === "workflows" ? filteredWorkflows.length : section === "failures" ? failures.length : filteredExecutions.length} visible</span>
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
                  {executions.filter((row) => ["running", "new", "waiting"].includes(row.status)).slice(0, 8).map((row) => (
                    <div key={row.id}>
                      <div><strong>{row.workflowName}</strong><span>Execution {row.id} · {fmtTime(row.startedAt)}</span></div>
                      <Status value={row.status} />
                    </div>
                  ))}
                  {!executions.some((row) => ["running", "new", "waiting"].includes(row.status)) && (
                    <Empty title="No workflows running">Nothing is currently executing or waiting.</Empty>
                  )}
                </div>
              </article>

              <article className="n8nc-panel">
                <div className="n8nc-panel-head">
                  <div><span>FAILURE RADAR</span><h2>Highest failure concentration</h2></div>
                  <b>{failures.length}</b>
                </div>
                <div className="n8nc-list">
                  {failureGroups.slice(0, 6).map((group) => (
                    <div key={group.workflowId || group.workflowName}>
                      <div><strong>{group.workflowName}</strong><span>Latest {fmtTime(group.latest?.startedAt)}</span></div>
                      <em>{group.count} fail{group.count === 1 ? "" : "s"}</em>
                    </div>
                  ))}
                  {!failureGroups.length && <Empty title="No failures in the loaded window">Recent execution history is clean.</Empty>}
                </div>
              </article>
            </section>

            <section className="n8nc-panel n8nc-recent">
              <div className="n8nc-panel-head">
                <div><span>RECENT EXECUTIONS</span><h2>What n8n has been doing</h2></div>
                <button className="n8nc-text-button" onClick={() => setSection("executions")}>View all →</button>
              </div>
              <ExecutionTable rows={filteredExecutions.slice(0, 12)} />
            </section>
          </>
        )}

        {section === "workflows" && (
          <section className="n8nc-panel">
            <div className="n8nc-panel-head">
              <div><span>WORKFLOW INVENTORY</span><h2>All automations</h2></div>
              <small>{snapshot?.writeEnabled ? "Owner controls active" : "Controls read-only until owner gate is configured"}</small>
            </div>
            <div className="n8nc-table-wrap">
              <table>
                <thead><tr><th>Workflow</th><th>Trigger</th><th>Tags</th><th>Updated</th><th>Status</th><th>Control</th></tr></thead>
                <tbody>
                  {filteredWorkflows.map((workflow) => (
                    <tr key={workflow.id}>
                      <td>
                        <strong>{workflow.name}</strong>
                        <small>{workflow.id}</small>
                      </td>
                      <td>{workflow.triggers?.length ? workflow.triggers.join(", ") : "Internal / sub-workflow"}</td>
                      <td>{workflow.tags?.length ? workflow.tags.join(", ") : "—"}</td>
                      <td>{fmtTime(workflow.updatedAt)}</td>
                      <td><Status value={workflow.active ? "active" : "inactive"} /></td>
                      <td>
                        <div className="n8nc-row-actions">
                          {snapshot?.instanceUrl && (
                            <a href={`${snapshot.instanceUrl}/workflow/${workflow.id}`} target="_blank" rel="noreferrer">Open ↗</a>
                          )}
                          <button
                            disabled={!snapshot?.writeEnabled || busyId === workflow.id}
                            onClick={() => handleToggle(workflow)}
                            title={!snapshot?.writeEnabled ? "Owner write gate is not enabled" : workflow.active ? "Deactivate workflow" : "Activate workflow"}
                          >
                            {busyId === workflow.id ? "Working…" : workflow.active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filteredWorkflows.length && <Empty title="No workflows found">Adjust the search or connect the n8n instance.</Empty>}
          </section>
        )}

        {section === "executions" && (
          <section className="n8nc-panel">
            <div className="n8nc-panel-head">
              <div><span>EXECUTION LEDGER</span><h2>Recent runs</h2></div>
              <small>Payload data is intentionally not returned to this UI.</small>
            </div>
            <ExecutionTable rows={filteredExecutions} />
          </section>
        )}

        {section === "failures" && (
          <section className="n8nc-panel">
            <div className="n8nc-panel-head">
              <div><span>FAILURE QUEUE</span><h2>Executions needing attention</h2></div>
              <b>{failures.length}</b>
            </div>
            <ExecutionTable rows={failures} />
            {!failures.length && <Empty title="No failures found">No error, crash or cancellation appears in the loaded execution window.</Empty>}
          </section>
        )}

        {section === "schedules" && (
          <section className="n8nc-panel">
            <div className="n8nc-panel-head">
              <div><span>SCHEDULE INVENTORY</span><h2>Scheduled workflows</h2></div>
              <b>{scheduled.length}</b>
            </div>
            <div className="n8nc-schedule-grid">
              {scheduled.map((workflow) => (
                <article key={workflow.id}>
                  <div><Status value={workflow.active ? "active" : "inactive"} /><span>Schedule Trigger</span></div>
                  <h3>{workflow.name}</h3>
                  <p>{workflow.tags?.length ? workflow.tags.join(" · ") : "No workflow tags"}</p>
                  {snapshot?.instanceUrl && <a href={`${snapshot.instanceUrl}/workflow/${workflow.id}`} target="_blank" rel="noreferrer">Inspect schedule in n8n ↗</a>}
                </article>
              ))}
            </div>
            {!scheduled.length && <Empty title="No scheduled workflows found">No loaded workflow contains a Schedule Trigger.</Empty>}
          </section>
        )}

        <footer className="n8nc-footer">
          <span>n8n remains the execution engine · Vercel is the operator cockpit.</span>
          <span>Reads: Firebase-authenticated · Secrets: server-side · Writes: owner-gated + logged</span>
        </footer>
      </main>
    </div>
  );
}

function ExecutionTable({ rows }) {
  if (!rows.length) return null;
  return (
    <div className="n8nc-table-wrap">
      <table>
        <thead><tr><th>Execution</th><th>Workflow</th><th>Status</th><th>Mode</th><th>Started</th><th>Duration</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><strong>#{row.id}</strong>{row.retryOf && <small>retry of {row.retryOf}</small>}</td>
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
