import React, { useMemo, useState } from "react";
import "./work-control-v2.css";

const milestones = [
  { id: "M-001", title: "Formalize Work Control v2", status: "DONE", owner: "Agent 000", sequence: "1.1" },
  { id: "M-002", title: "Connect real execution/state", status: "READY", owner: "Agent 000", sequence: "1.2" },
  { id: "M-003", title: "Universal n8n → AI → data pipeline", status: "BACKLOG", owner: "Agent 000", sequence: "1.3" },
  { id: "M-004", title: "Run SourceMargin", status: "BACKLOG", owner: "Agent 000", sequence: "2" },
  { id: "M-005", title: "Run Acquisition Radar", status: "BACKLOG", owner: "Agent 000", sequence: "3" },
  { id: "M-006", title: "Run 016 / Nembra", status: "BACKLOG", owner: "Agent 000", sequence: "4" },
  { id: "M-007", title: "Economics decision gate", status: "BACKLOG", owner: "Owner", sequence: "5" },
];

const workOrders = [
  {
    id: "WO-002A",
    parent: "M-002",
    title: "Define execution adapter contract",
    status: "READY",
    priority: "P0",
    owner: "Run 014",
    executor: "Software engineering specialists",
    next: "Implement adapter against one low-risk test workflow",
    done: "Input/output/state/error/idempotency contract accepted",
    qa: ["Q1", "Q3"],
    dependency: "Work Control v1 request/state model",
  },
  {
    id: "WO-002B",
    parent: "M-002",
    title: "Add persistent execution ledger",
    status: "BACKLOG",
    priority: "P0",
    owner: "Run 014",
    executor: "Backend/data specialists",
    next: "Wire adapter events into ledger",
    done: "Requests, transitions, evidence, QA, approvals and results persist",
    qa: ["Q1", "Q3"],
    dependency: "WO-002A",
  },
  {
    id: "WO-002C",
    parent: "M-002",
    title: "Prove one live governed work order",
    status: "BACKLOG",
    priority: "P0",
    owner: "Agent 000",
    executor: "Run 014 / Operations Core",
    next: "Release M-003 after QA pass",
    done: "READY → IN_PROGRESS → QA → DONE occurs with evidence and truthful state",
    qa: ["Q1", "Q2", "Q3"],
    dependency: "WO-002A + WO-002B",
  },
];

const laneItems = [
  { label: "Foundation", detail: "M-002", state: "active" },
  { label: "SourceMargin", detail: "M-004", state: "next" },
  { label: "Acquisition Radar", detail: "M-005", state: "queued" },
  { label: "Run 016 / Nembra", detail: "M-006", state: "queued" },
  { label: "Economics", detail: "M-007", state: "decision" },
];

function StatusPill({ status }) {
  return <span className={`wc-status wc-status-${status.toLowerCase()}`}>{status.replaceAll("_", " ")}</span>;
}

function Icon({ name }) {
  const icons = {
    overview: "⌂",
    today: "◎",
    queue: "≡",
    approvals: "✓",
    qa: "◇",
    machines: "⚙",
  };
  return <span className="wc-nav-icon">{icons[name] || "•"}</span>;
}

export default function WorkControlV2() {
  const [section, setSection] = useState("overview");
  const [selectedId, setSelectedId] = useState("WO-002A");
  const [query, setQuery] = useState("");

  const selected = workOrders.find((item) => item.id === selectedId) || workOrders[0];
  const doneCount = milestones.filter((m) => m.status === "DONE").length;
  const progress = Math.round((doneCount / milestones.length) * 100);

  const filteredWork = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return workOrders;
    return workOrders.filter((item) =>
      [item.id, item.title, item.owner, item.executor, item.status].join(" ").toLowerCase().includes(needle)
    );
  }, [query]);

  const nav = [
    ["overview", "Overview"],
    ["today", "Today"],
    ["queue", "Work queue"],
    ["approvals", "Approvals"],
    ["qa", "QA gates"],
    ["machines", "Machines"],
  ];

  return (
    <div className="wc-app">
      <aside className="wc-sidebar">
        <div className="wc-brand">
          <div className="wc-brand-mark">F</div>
          <div>
            <strong>Factory</strong>
            <span>Work Control</span>
          </div>
        </div>

        <nav className="wc-nav">
          {nav.map(([key, label]) => (
            <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}>
              <Icon name={key} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="wc-sidebar-foot">
          <div className="wc-connection-dot" />
          <div>
            <strong>Preview mode</strong>
            <span>Execution adapter disconnected</span>
          </div>
        </div>
      </aside>

      <main className="wc-main">
        <header className="wc-topbar">
          <div>
            <div className="wc-eyebrow">REF-FACTORY-EXEC-2026-09-07</div>
            <h1>Execution Control</h1>
          </div>
          <div className="wc-top-actions">
            <div className="wc-search-wrap">
              <span>⌕</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search work" />
            </div>
            <button className="wc-owner-button">Owner</button>
          </div>
        </header>

        <div className="wc-preview-banner">
          <strong>Safe preview.</strong> This UI shows the live execution plan, but buttons do not dispatch Factory or n8n work until M-002 connects the execution adapter.
        </div>

        {(section === "overview" || section === "today") && (
          <>
            <section className="wc-objective-card">
              <div className="wc-objective-copy">
                <div className="wc-section-kicker">PRIMARY OBJECTIVE · OBJ-001</div>
                <h2>Build the reusable AI production machine</h2>
                <p>One dependable substrate that can run multiple commercial workloads without rebuilding core plumbing.</p>
                <div className="wc-objective-meta">
                  <div><span>Operating manager</span><strong>Agent 000</strong></div>
                  <div><span>Active milestone</span><strong>M-002</strong></div>
                  <div><span>Priority</span><strong>P0</strong></div>
                </div>
              </div>
              <div className="wc-progress-card">
                <div className="wc-progress-number">{progress}%</div>
                <span>milestones complete</span>
                <div className="wc-progress-track"><i style={{ width: `${progress}%` }} /></div>
                <small>{doneCount} of {milestones.length} milestones</small>
              </div>
            </section>

            <section className="wc-grid wc-grid-primary">
              <article className="wc-panel wc-next-panel">
                <div className="wc-panel-head">
                  <div>
                    <span className="wc-section-kicker">NEXT ACTION</span>
                    <h3>Connect real execution/state</h3>
                  </div>
                  <StatusPill status="READY" />
                </div>
                <p className="wc-next-copy">Connect the existing Work Control interface to a real execution/state adapter and persistent ledger.</p>
                <div className="wc-next-row"><span>First work order</span><strong>WO-002A · Define execution adapter contract</strong></div>
                <div className="wc-next-row"><span>Accountable owner</span><strong>Run 014</strong></div>
                <div className="wc-next-row"><span>Definition of done</span><strong>One governed request reports truthful live state and evidence</strong></div>
                <button className="wc-primary-button" disabled title="Execution adapter not connected">Dispatch disabled until adapter is connected</button>
              </article>

              <article className="wc-panel">
                <div className="wc-panel-head">
                  <div>
                    <span className="wc-section-kicker">TODAY</span>
                    <h3>Work stack</h3>
                  </div>
                  <span className="wc-count-badge">3 items</span>
                </div>
                <div className="wc-today-list">
                  {workOrders.map((item, index) => (
                    <button key={item.id} onClick={() => setSelectedId(item.id)} className={selectedId === item.id ? "selected" : ""}>
                      <span className="wc-order-number">0{index + 1}</span>
                      <span className="wc-order-copy"><strong>{item.title}</strong><small>{item.id} · {item.owner}</small></span>
                      <StatusPill status={item.status} />
                    </button>
                  ))}
                </div>
              </article>
            </section>

            <section className="wc-panel wc-lane-panel">
              <div className="wc-panel-head">
                <div>
                  <span className="wc-section-kicker">STRATEGIC SEQUENCE</span>
                  <h3>What comes next</h3>
                </div>
                <span className="wc-muted">New ideas enter backlog by default</span>
              </div>
              <div className="wc-lane">
                {laneItems.map((item, index) => (
                  <React.Fragment key={item.label}>
                    <div className={`wc-lane-item wc-lane-${item.state}`}>
                      <span>{item.detail}</span>
                      <strong>{item.label}</strong>
                      <small>{item.state === "active" ? "NOW" : item.state === "next" ? "NEXT" : item.state === "decision" ? "DECIDE" : "QUEUED"}</small>
                    </div>
                    {index < laneItems.length - 1 && <div className="wc-lane-arrow">→</div>}
                  </React.Fragment>
                ))}
              </div>
            </section>
          </>
        )}

        {(section === "overview" || section === "queue") && (
          <section className="wc-grid wc-grid-queue">
            <article className="wc-panel wc-table-panel">
              <div className="wc-panel-head">
                <div>
                  <span className="wc-section-kicker">WORK QUEUE</span>
                  <h3>M-002 work orders</h3>
                </div>
                <span className="wc-muted">WIP limit: 1 primary work order / owner</span>
              </div>
              <div className="wc-table-wrap">
                <table>
                  <thead><tr><th>ID</th><th>Work order</th><th>Owner</th><th>Priority</th><th>Status</th></tr></thead>
                  <tbody>
                    {filteredWork.map((item) => (
                      <tr key={item.id} onClick={() => setSelectedId(item.id)} className={selectedId === item.id ? "selected" : ""}>
                        <td><strong>{item.id}</strong></td>
                        <td>{item.title}</td>
                        <td>{item.owner}</td>
                        <td>{item.priority}</td>
                        <td><StatusPill status={item.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <aside className="wc-panel wc-detail-panel">
              <div className="wc-panel-head">
                <div>
                  <span className="wc-section-kicker">SELECTED WORK</span>
                  <h3>{selected.id}</h3>
                </div>
                <StatusPill status={selected.status} />
              </div>
              <h4>{selected.title}</h4>
              <dl>
                <div><dt>Executor</dt><dd>{selected.executor}</dd></div>
                <div><dt>Dependency</dt><dd>{selected.dependency}</dd></div>
                <div><dt>Next action</dt><dd>{selected.next}</dd></div>
                <div><dt>Definition of done</dt><dd>{selected.done}</dd></div>
              </dl>
              <div className="wc-qa-row">
                <span>Required QA</span>
                <div>{selected.qa.map((qa) => <b key={qa}>{qa}</b>)}</div>
              </div>
            </aside>
          </section>
        )}

        {section === "approvals" && (
          <section className="wc-panel wc-empty-state">
            <div className="wc-empty-icon">✓</div>
            <h2>No owner approvals waiting</h2>
            <p>Strategic changes, capital commitments, material limitations, external transactions and scale decisions will appear here.</p>
          </section>
        )}

        {section === "qa" && (
          <section className="wc-grid wc-qa-grid">
            {[
              ["Q1", "Operational QA", "Schemas, state, routing, formulas, retries, tests and runtime behavior."],
              ["Q2", "Evidence / Compliance QA", "Provenance, freshness, contradictions, calculations, policy and claim strength."],
              ["Q3", "Professional Excellence QA", "Whether the result meets an excellent-practitioner standard in every material discipline."],
            ].map(([code, title, detail]) => (
              <article className="wc-panel wc-qa-card" key={code}>
                <span>{code}</span>
                <h3>{title}</h3>
                <p>{detail}</p>
                <small>Independent gate</small>
              </article>
            ))}
          </section>
        )}

        {section === "machines" && (
          <section className="wc-grid wc-machines-grid">
            {[
              ["Work Control", "Managerial layer", "READY", "Objectives, ownership, sequencing and QA"],
              ["Execution adapter", "Factory bridge", "BLOCKED", "M-002 — not connected yet"],
              ["n8n", "Orchestration", "READY", "Scheduled / on-demand workflow engine"],
              ["Persistent ledger", "State + evidence", "BACKLOG", "WO-002B"],
            ].map(([title, kind, status, detail]) => (
              <article className="wc-panel wc-machine-card" key={title}>
                <div className="wc-panel-head"><span className="wc-section-kicker">{kind}</span><StatusPill status={status} /></div>
                <h3>{title}</h3>
                <p>{detail}</p>
              </article>
            ))}
          </section>
        )}

        <footer className="wc-footer">
          <span>Factory Execution / Work Control v2</span>
          <span>Strategy → Objective → Milestone → Work Order → Task → QA → Result → Next Action</span>
        </footer>
      </main>
    </div>
  );
}
