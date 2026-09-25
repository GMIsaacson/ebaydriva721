import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthProvider";
import { controlWorkflow, enrollWorkflowOwner, fetchFactoryLive, fetchN8nSnapshot, fetchWorkflowResult } from "./n8nControlApi";
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

function friendlyNodeType(type) {
  const key = String(type || "").split(".").pop();
  const labels = {
    manualTrigger: "Manual trigger",
    scheduleTrigger: "Schedule trigger",
    webhook: "Webhook",
    respondToWebhook: "Webhook response",
    postgres: "Postgres",
    code: "Code",
    gmail: "Gmail",
    httpRequest: "HTTP request",
    noOp: "Result / pass-through",
  };
  return labels[key] || key || "Unknown node";
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
  const [claimCode, setClaimCode] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const [factoryLive, setFactoryLive] = useState(null);
  const [factoryError, setFactoryError] = useState(null);

  const refresh = async ({ quiet = false } = {}) => {
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

  useEffect(() => {
    let cancelled = false;
    const readFactory = async () => {
      try {
        const data = await fetchFactoryLive();
        if (!cancelled) {
          setFactoryLive(data);
          setFactoryError(null);
        }
      } catch (err) {
        if (!cancelled) setFactoryError(err.message);
      }
    };
    readFactory();
    const timer = window.setInterval(readFactory, 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const workflows = snapshot?.workflows || [];
  const executions = snapshot?.executions || [];
  const needle = query.trim().toLowerCase();

  const filteredWorkflows = useMemo(() => {
    if (!needle) return workflows;
    return workflows.filter((row) =>
      [
        row.name,
        row.id,
        row.schedule,
        row.operationalState,
        row.about?.purpose,
        row.about?.reads,
        row.about?.produces,
        ...(row.nodes || []).flatMap((node) => [node.name, node.type]),
      ].join(" ").toLowerCase().includes(needle)
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

  const handleOwnerEnrollment = async () => {
    const code = claimCode.trim();
    if (!code || claimBusy) return;
    setClaimBusy(true);
    setNotice("");
    try {
      await enrollWorkflowOwner(currentUser, code);
      setClaimCode("");
      setNotice("Owner controls claimed for this signed-in Factory account.");
      await refresh({ quiet: true });
    } catch (err) {
      setNotice(`Control failed: ${err.message}`);
    } finally {
      setClaimBusy(false);
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
    ["live", "Live Factory"],
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
          <div className="n8nc-mark">FC</div>
          <div><strong>Factory Control</strong><span>Work Control + orchestration</span></div>
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
            <div className="n8nc-eyebrow">FACTORY · GOVERNED EXECUTION CONTROL PLANE</div>
            <h1>Factory Control Center</h1>
            <p>See Work Control commands, the agent or worker currently acting, the active SourceMargin process, n8n workflow state, failures and governed execution from one surface.</p>
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
            <strong>{snapshot?.writeEnabled ? "Owner controls enabled" : "Read-only cockpit"}</strong>
            <small>{snapshot?.writeEnabled ? "Pause / resume / restart are authorized and audited." : "Viewing and analysis are open here; lifecycle mutations remain owner-protected."}</small>
          </div>
          <div>
            <span className={factoryLive?.ok ? "n8nc-dot live" : "n8nc-dot"} />
            <strong>{factoryLive?.ok ? "Work Control live" : factoryError ? "Work Control offline" : "Checking Work Control"}</strong>
            <small>{factoryLive?.fetchedAt ? `Updated ${fmtTime(factoryLive.fetchedAt)} · 3s live refresh` : "Reading canonical command / claim / receipt ledger"}</small>
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
              <code>WORKFLOW_CONTROL_BASE_URL</code><span>Factory workflow telemetry service</span>
              <code>READ MODE</code><span>No DataScout login is required for workflow inspection</span>
              <code>WRITE MODE</code><span>Pause, resume, and restart remain owner-protected</span>
            </div>
            <small>Current gateway response: {error.message}</small>
          </section>
        )}

        {!error && snapshot?.connected && !currentUser && (
          <section className="n8nc-readonly-note">
            <strong>Direct cockpit access is active.</strong>
            <span>No DataScout login is required to inspect workflows, nodes, schedules, health, or latest results. Lifecycle controls remain locked.</span>
          </section>
        )}

        {!error && snapshot?.connected && currentUser && snapshot?.owner?.enrolled === false && (
          <section className="n8nc-owner-enroll">
            <div>
              <span>OPTIONAL OWNER CONTROL ENROLLMENT</span>
              <strong>Claim lifecycle controls for this signed-in Factory account</strong>
              <p>Read access does not depend on this. Enrollment is only for pause, resume, and restart.</p>
            </div>
            <div className="n8nc-owner-enroll-form">
              <input
                type="password"
                value={claimCode}
                onChange={(event) => setClaimCode(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") handleOwnerEnrollment(); }}
                placeholder="Owner bootstrap code"
                autoComplete="off"
              />
              <button disabled={!claimCode.trim() || claimBusy} onClick={handleOwnerEnrollment}>
                {claimBusy ? "Claiming…" : "Claim owner controls"}
              </button>
            </div>
          </section>
        )}

        {!error && snapshot?.connected && currentUser && snapshot?.owner?.enrolled && !snapshot?.owner?.isOwner && (
          <section className="n8nc-readonly-note">
            <strong>Live read mode is operational.</strong>
            <span>Lifecycle controls are owned by another enrolled Factory account.</span>
          </section>
        )}

        {!error && snapshot?.connected && currentUser && snapshot?.owner?.isOwner && (
          <section className="n8nc-owner-active">
            <strong>Owner controls active.</strong>
            <span>This Factory account can pause, resume, and restart managed workflows.</span>
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

        {section === "live" && (
          <section className="n8nc-live-factory">
            <div className="n8nc-live-hero">
              <div>
                <span>CANONICAL WORK CONTROL LEDGER</span>
                <h2>What the Factory is doing now</h2>
                <p>Every row is a governed Work Control command. SourceMargin canonical persistence now requires a matching live command and active worker claim before a result can be written.</p>
              </div>
              <div className="n8nc-live-summary">
                <Metric value={factoryLive?.metrics?.active ?? "—"} label="Active Factory work" />
                <Metric value={factoryLive?.metrics?.sourceMarginActive ?? "—"} label="SourceMargin active" />
                <Metric value={factoryLive?.metrics?.blocked ?? "—"} label="Blocked recorded" />
              </div>
            </div>

            {factoryError && (
              <div className="n8nc-notice error">Work Control telemetry: {factoryError}</div>
            )}

            <div className="n8nc-panel n8nc-live-panel">
              <div className="n8nc-panel-head">
                <div><span>RUNNING / QUEUED / CLAIMED</span><h2>Active governed work</h2></div>
                <small>{factoryLive?.connection?.mode || "—"} · {factoryLive?.connection?.executor || "—"}</small>
              </div>
              <FactoryWorkTable rows={factoryLive?.active || []} />
              {!factoryLive?.active?.length && !factoryError && (
                <Empty title="No active commands">The Work Control ledger has no queued, claimed, or running command at this instant.</Empty>
              )}
            </div>

            <div className="n8nc-panel n8nc-live-panel">
              <div className="n8nc-panel-head">
                <div><span>SOURCEMARGIN · RUN 004</span><h2>Latest SourceMargin processes</h2></div>
                <small>Agent 000 → Work Control → specialist worker → canonical persistence</small>
              </div>
              <FactoryWorkTable rows={factoryLive?.sourceMarginRecent || []} limit={25} />
            </div>
          </section>
        )}

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
              <small>{snapshot?.writeEnabled ? "Owner controls active" : "Lifecycle controls remain locked; telemetry and results are live"}</small>
            </div>

            <div className="n8nc-workflow-grid">
              {filteredWorkflows.map((workflow) => {
                const paused = workflow.operationalState === "paused";
                const lastRun = workflow.latestExecution;
                const completed = workflow.latestCompleted;
                return (
                  <article className="n8nc-workflow-card" key={workflow.id}>
                    <div className="n8nc-workflow-card-head">
                      <div>
                        <span className="n8nc-workflow-id">{workflow.id}</span>
                        <h3>{workflow.name}</h3>
                      </div>
                      <Status value={workflow.operationalState} />
                    </div>

                    <div className="n8nc-workflow-purpose">
                      <span>WHAT THIS WORKFLOW IS FOR</span>
                      <p>{workflow.about?.purpose || "Purpose metadata has not yet been normalized."}</p>
                    </div>

                    <details className="n8nc-workflow-details">
                      <summary>
                        <span>Workflow details</span>
                        <b>{workflow.nodes?.length || 0} nodes</b>
                      </summary>

                      <div className="n8nc-workflow-details-body">
                        <div className="n8nc-workflow-io">
                          <div>
                            <span>Reads / trigger inputs</span>
                            <p>{workflow.about?.reads || "See workflow node graph."}</p>
                          </div>
                          <div>
                            <span>Produces</span>
                            <p>{workflow.about?.produces || "See latest workflow result."}</p>
                          </div>
                        </div>

                        <div className="n8nc-node-section">
                          <div className="n8nc-node-section-head">
                            <span>LIVE N8N NODE INVENTORY</span>
                            <small>Ordered from the current workflow definition</small>
                          </div>
                          <ol className="n8nc-node-list">
                            {(workflow.nodes || []).map((node) => (
                              <li key={`${workflow.id}-${node.order}-${node.name}`} className={node.disabled ? "disabled" : ""}>
                                <span className="n8nc-node-order">{String(node.order).padStart(2, "0")}</span>
                                <div>
                                  <strong>{node.name}</strong>
                                  <small title={node.type}>{friendlyNodeType(node.type)}{node.disabled ? " · disabled" : ""}</small>
                                </div>
                              </li>
                            ))}
                          </ol>
                          {!workflow.nodes?.length && (
                            <div className="n8nc-node-empty">No node inventory returned by the live workflow service.</div>
                          )}
                        </div>
                      </div>
                    </details>

                    <dl className="n8nc-workflow-meta">
                      <div><dt>Cadence</dt><dd>{workflow.schedule}</dd></div>
                      <div><dt>Latest run</dt><dd>{lastRun ? `${lastRun.status} · ${fmtTime(lastRun.startedAt)}` : "No run recorded"}</dd></div>
                      <div><dt>Last completed</dt><dd>{completed ? `${fmtTime(completed.stoppedAt)} · ${fmtDuration(completed.durationMs)}` : "—"}</dd></div>
                      <div><dt>Errors · 24h</dt><dd className={workflow.errors24h ? "n8nc-workflow-error-value" : ""}>{workflow.errors24h || 0}</dd></div>
                    </dl>

                    {workflow.id === "EMAILINTELV1" && workflow.special?.gmailState === "needs_reconnect" && (
                      <div className="n8nc-workflow-alert">Gmail connection needs attention before this workflow can process mail.</div>
                    )}

                    <div className="n8nc-workflow-actions">
                      <button className="n8nc-result-button" onClick={() => openResult(workflow)}>View latest result</button>
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
                  </article>
                );
              })}
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
          <span>n8n stays private on localhost · Vercel is the direct read/analysis cockpit.</span>
          <span>Telemetry: open cockpit read · Mutations: owner-gated and authenticated</span>
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

function FactoryWorkTable({ rows, limit = 30 }) {
  const visible = (rows || []).slice(0, limit);
  if (!visible.length) return null;
  return (
    <div className="n8nc-table-wrap">
      <table className="n8nc-factory-table">
        <thead><tr><th>Command</th><th>Process</th><th>Team / agent</th><th>Status</th><th>Progress</th><th>Current stage</th><th>Started</th></tr></thead>
        <tbody>
          {visible.map((row) => (
            <tr key={row.commandId}>
              <td><strong>{row.commandId}</strong><small>{row.priority || "normal"}</small></td>
              <td><strong>{row.process || "Governed work"}</strong><small title={row.title}>{row.title}</small></td>
              <td><strong>{row.teamId || "—"}</strong><small>{row.teamName || "—"}</small></td>
              <td><Status value={row.status} /></td>
              <td>{row.progress == null ? "—" : `${row.progress}%`}</td>
              <td><strong>{row.latestStage?.name || row.next || "—"}</strong><small>{row.latestStage?.detail || row.next || "—"}</small></td>
              <td>{fmtTime(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
