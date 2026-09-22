import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthProvider";
import { fetchSourceGraphControl } from "./sourceGraphControlApi";
import "./source-graph-control.css";

function pct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return `${Math.round(Number(value) * 100)}%`;
}

function Status({ value }) {
  return <span className={`sgc-status sgc-status-${String(value || "unknown").toLowerCase()}`}>{String(value || "unknown").replaceAll("_", " ")}</span>;
}

function Metric({ label, value, detail }) {
  return (
    <div className="sgc-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

export default function SourceGraphControl() {
  const { currentUser } = useAuth();
  const [snapshot, setSnapshot] = useState(null);
  const [state, setState] = useState("LOADING");
  const [error, setError] = useState("");

  const refresh = async () => {
    if (!currentUser) return;
    setState("LOADING");
    setError("");
    try {
      const data = await fetchSourceGraphControl(currentUser);
      setSnapshot(data);
      setState("READY");
    } catch (err) {
      setState("ERROR");
      setError(err?.message || "Source Graph operations could not load.");
    }
  };

  useEffect(() => {
    refresh();
  }, [currentUser]);

  const metrics = snapshot?.metrics || {};
  const runs = snapshot?.runs || [];
  const queue = snapshot?.queue || [];
  const active = useMemo(
    () => runs.filter((run) => ["queued", "running", "blocked"].includes(run.status)),
    [runs]
  );

  return (
    <div className="sgc-page">
      <header className="sgc-header">
        <div>
          <div className="sgc-eyebrow">SOURCEMARGIN · SOURCE GRAPH</div>
          <h1>Source Graph Operations</h1>
          <p>Operational visibility for Seller Mine, Supplier Mine and Product Trace. Canonical state remains in SourceMargin.</p>
        </div>
        <button type="button" onClick={refresh} disabled={state === "LOADING"} className="sgc-refresh">
          {state === "LOADING" ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {state === "ERROR" ? (
        <div className="sgc-alert sgc-alert-error">
          <strong>Source Graph telemetry unavailable.</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {snapshot?.authority ? (
        <div className="sgc-alert sgc-alert-authority">
          <div>
            <strong>{snapshot.authority.mode.replaceAll("_", " ")}</strong>
            <span>{snapshot.authority.reason}</span>
          </div>
          <div className="sgc-locked-actions" aria-label="Source Graph controls">
            <button disabled title={snapshot.authority.reason}>Pause</button>
            <button disabled title={snapshot.authority.reason}>Restart</button>
            <button disabled title={snapshot.authority.reason}>Retry</button>
          </div>
        </div>
      ) : null}

      <section className="sgc-metrics" aria-label="Source Graph operational metrics">
        <Metric label="Runs" value={metrics.runs?.total ?? "—"} detail={`${metrics.runs?.blocked ?? 0} blocked · ${metrics.runs?.running ?? 0} running`} />
        <Metric label="Open tasks" value={(metrics.tasks?.queued || 0) + (metrics.tasks?.in_progress || 0) + (metrics.tasks?.blocked || 0)} detail={`${metrics.tasks?.resolved ?? 0} resolved`} />
        <Metric label="Reconstruction" value={pct(metrics.reconstruction_rate)} detail="hard reconstruction" />
        <Metric label="Exact match" value={pct(metrics.exact_match_rate)} detail="fixed benchmark" />
        <Metric label="Dealer pricing" value={pct(metrics.dealer_price_retrieval_rate)} detail="retrieval rate" />
        <Metric label="Availability" value={pct(metrics.current_availability_retrieval_rate)} detail="current verification" />
        <Metric label="30-day demand" value={pct(metrics.demand_verification_rate)} detail="verification rate" />
        <Metric label="Source Ready" value={pct(metrics.source_ready_yield)} detail="yield from runs" />
      </section>

      <section className="sgc-grid">
        <article className="sgc-panel">
          <div className="sgc-panel-head">
            <div>
              <span>ACTIVE / BLOCKED RUNS</span>
              <h2>Source Graph work</h2>
            </div>
            <b>{active.length}</b>
          </div>

          {state === "LOADING" && !snapshot ? <p className="sgc-empty">Loading canonical Source Graph state…</p> : null}
          {state !== "LOADING" && !active.length ? <p className="sgc-empty">No active Source Graph runs.</p> : null}

          <div className="sgc-run-list">
            {active.map((run) => (
              <div className="sgc-run-card" key={run.run_id}>
                <div className="sgc-run-top">
                  <div>
                    <span>{run.run_type?.replaceAll("_", " ")}</span>
                    <h3>{run.subject_name || run.run_key}</h3>
                    <small>{run.run_key} · {run.marketplace || "internal"}</small>
                  </div>
                  <Status value={run.status} />
                </div>
                <div className="sgc-run-facts">
                  <div><span>Stage</span><strong>{run.stage?.replaceAll("_", " ")}</strong></div>
                  <div><span>Reconstructed</span><strong>{run.hard_reconstruction_count ?? "—"}/{run.sample_size ?? "—"} · {pct(run.hard_reconstruction_rate)}</strong></div>
                  <div><span>Source relationships</span><strong>{run.source_relationship_count ?? "—"}</strong></div>
                  <div><span>Agent / workflow</span><strong>{run.agent_id || run.workflow_id || "Not dispatched"}</strong></div>
                </div>
                {Array.isArray(run.blockers) && run.blockers.length ? (
                  <div className="sgc-blockers">
                    <strong>Blockers</strong>
                    <ul>{run.blockers.map((item) => <li key={item}>{item}</li>)}</ul>
                  </div>
                ) : null}
                <div className="sgc-next">
                  <span>Next action</span>
                  <p>{run.next_action || "No next action recorded."}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="sgc-panel">
          <div className="sgc-panel-head">
            <div>
              <span>RESOLUTION QUEUE</span>
              <h2>What is blocking progress</h2>
            </div>
            <b>{queue.length}</b>
          </div>

          {!queue.length ? <p className="sgc-empty">No unresolved Source Graph tasks.</p> : (
            <div className="sgc-table-wrap">
              <table className="sgc-table">
                <thead>
                  <tr><th>Priority</th><th>Task</th><th>Status</th><th>Blocker</th><th>Next action</th></tr>
                </thead>
                <tbody>
                  {queue.map((task) => (
                    <tr key={task.task_id}>
                      <td><strong>{task.priority}</strong></td>
                      <td><div>{task.task_type?.replaceAll("_", " ")}</div><small>{task.run_key}</small></td>
                      <td><Status value={task.status} /></td>
                      <td>{task.blocker_code ? task.blocker_code.replaceAll("_", " ") : "—"}</td>
                      <td>{task.next_action || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>

      <footer className="sgc-foot">
        <span>Entities {metrics.entities ?? "—"} · Edges {metrics.edges ?? "—"} · Published snapshots {metrics.published_snapshots ?? "—"}</span>
        <span>Snapshot {snapshot?.generated_at ? new Date(snapshot.generated_at).toLocaleString() : "pending"}</span>
      </footer>
    </div>
  );
}
