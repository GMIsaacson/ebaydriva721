import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthProvider";
import {
  ensureLedger,
  subscribeEvents,
  subscribeItems,
  transitionItem,
  updateItemFields,
} from "./workControlLedger";
import {
  dispatchWorkOrder,
  fetchExecution,
  fetchGatewayHealth,
} from "./workControlDispatch";
import "./work-control-v2.css";
import "./work-control-ledger.css";

function StatusPill({ status = "BACKLOG" }) {
  return <span className={`wc-status wc-status-${String(status).toLowerCase()}`}>{String(status).replaceAll("_", " ")}</span>;
}

function Icon({ name }) {
  const icons = { overview: "⌂", today: "◎", queue: "≡", approvals: "✓", qa: "◇", machines: "⚙", history: "↺" };
  return <span className="wc-nav-icon">{icons[name] || "•"}</span>;
}

const qaDescriptions = [
  ["Q1", "Operational QA", "Schemas, state, routing, formulas, retries, tests and runtime behavior."],
  ["Q2", "Evidence / Compliance QA", "Provenance, freshness, contradictions, calculations, policy and claim strength."],
  ["Q3", "Professional Excellence QA", "Whether the result meets an excellent-practitioner standard in every material discipline."],
];

function nextAllowedActions(status) {
  switch (status) {
    case "BACKLOG": return [["Make ready", "READY"]];
    case "READY": return [["Start manually", "IN_PROGRESS"], ["Block", "BLOCKED"]];
    case "IN_PROGRESS": return [["Send to QA", "QA"], ["Block", "BLOCKED"]];
    case "QA": return [["Return for revision", "IN_PROGRESS"], ["QA pass → done", "DONE"], ["Block", "BLOCKED"]];
    case "WAITING_APPROVAL": return [["Approve → done", "DONE"], ["Return", "IN_PROGRESS"]];
    case "BLOCKED": return [["Unblock → ready", "READY"]];
    default: return [];
  }
}

function formatEventTime(value) {
  if (!value) return "pending timestamp";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown time";
  return date.toLocaleString();
}

function remoteExecutionStatus(payload) {
  if (payload?.receipt?.terminalState) return payload.receipt.terminalState;
  if (payload?.claim && !payload?.receipt) return "CLAIMED";
  if (payload?.command?.executorState) return payload.command.executorState;
  if (payload?.work?.status) return String(payload.work.status).toUpperCase();
  return "QUEUED_GOVERNED";
}

export default function WorkControlV2() {
  const { currentUser } = useAuth();
  const [section, setSection] = useState("overview");
  const [selectedId, setSelectedId] = useState("WO-002A");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [ledgerState, setLedgerState] = useState("CONNECTING");
  const [ledgerError, setLedgerError] = useState("");
  const [adapterState, setAdapterState] = useState("CHECKING");
  const [adapterError, setAdapterError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid) return undefined;
    let unsubscribeItems = () => {};
    let unsubscribeEvents = () => {};
    let cancelled = false;

    const connect = async () => {
      setLedgerState("CONNECTING");
      setLedgerError("");
      try {
        await ensureLedger(currentUser.uid);
        if (cancelled) return;
        unsubscribeItems = subscribeItems(
          currentUser.uid,
          (rows) => {
            setItems(rows);
            setLedgerState("CONNECTED");
          },
          (error) => {
            console.error("Work Control item subscription failed", error);
            setLedgerState("ERROR");
            setLedgerError(error?.message || "Could not read execution ledger.");
          }
        );
        unsubscribeEvents = subscribeEvents(
          currentUser.uid,
          setEvents,
          (error) => console.error("Work Control event subscription failed", error)
        );
      } catch (error) {
        console.error("Work Control ledger initialization failed", error);
        if (!cancelled) {
          setLedgerState("ERROR");
          setLedgerError(error?.message || "Could not initialize execution ledger.");
        }
      }
    };

    connect();
    return () => {
      cancelled = true;
      unsubscribeItems();
      unsubscribeEvents();
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setAdapterState("CHECKING");
      setAdapterError("");
      try {
        const health = await fetchGatewayHealth();
        if (!cancelled) setAdapterState(health?.status === "READY" ? "READY" : "ERROR");
      } catch (error) {
        if (!cancelled) {
          setAdapterState("ERROR");
          setAdapterError(error?.message || "Execution gateway unavailable.");
        }
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  const objectives = useMemo(() => items.filter((item) => item.level === "objective"), [items]);
  const milestones = useMemo(() => items.filter((item) => item.level === "milestone"), [items]);
  const workOrders = useMemo(() => items.filter((item) => item.level === "work_order"), [items]);
  const objective = objectives.find((item) => item.id === "OBJ-001") || objectives[0];
  const selected = workOrders.find((item) => item.id === selectedId) || workOrders[0];
  const activeMilestone = milestones.find((item) => item.status === "IN_PROGRESS") || milestones.find((item) => item.status === "READY");
  const doneCount = milestones.filter((item) => item.status === "DONE").length;
  const progress = milestones.length ? Math.round((doneCount / milestones.length) * 100) : 0;
  const activeExecution = workOrders.find((item) => item.executionCommandId && item.status === "IN_PROGRESS");

  const filteredWork = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return workOrders;
    return workOrders.filter((item) =>
      [item.id, item.title, item.owner, item.executor, item.status, item.executionCommandId].join(" ").toLowerCase().includes(needle)
    );
  }, [query, workOrders]);

  const laneItems = useMemo(() => [
    ["M-002", "Foundation"],
    ["M-004", "SourceMargin"],
    ["M-005", "Acquisition Radar"],
    ["M-006", "Run 016 / Nembra"],
    ["M-007", "Economics"],
  ].map(([id, label]) => {
    const item = milestones.find((row) => row.id === id);
    return { id, label, status: item?.status || "BACKLOG" };
  }), [milestones]);

  useEffect(() => {
    if (!activeExecution?.executionCommandId || !currentUser?.uid) return undefined;
    let cancelled = false;
    let timer;

    const refresh = async () => {
      try {
        const payload = await fetchExecution(currentUser, activeExecution.executionCommandId);
        if (cancelled) return;
        const executionStatus = remoteExecutionStatus(payload);
        const receipt = payload?.receipt || null;
        const patch = {};

        if (executionStatus !== activeExecution.executionStatus) patch.executionStatus = executionStatus;
        if (receipt?.summary && receipt.summary !== activeExecution.executionResultSummary) patch.executionResultSummary = receipt.summary;
        if (receipt?.terminalState && receipt.terminalState !== activeExecution.executionTerminalState) patch.executionTerminalState = receipt.terminalState;
        if (receipt?.completedAt && receipt.completedAt !== activeExecution.executionCompletedAt) patch.executionCompletedAt = receipt.completedAt;

        if (Object.keys(patch).length) {
          await updateItemFields(currentUser.uid, activeExecution.id, patch, "execution-monitor");
        }

        if (receipt?.terminalState === "DELIVERED" && activeExecution.status === "IN_PROGRESS") {
          await transitionItem(currentUser.uid, activeExecution, "QA", "execution-monitor");
          return;
        }
        if (["BLOCKED_OWNER", "BLOCKED_EXTERNAL", "FAILED"].includes(receipt?.terminalState) && activeExecution.status === "IN_PROGRESS") {
          await transitionItem(currentUser.uid, activeExecution, "BLOCKED", "execution-monitor");
          return;
        }
        if (receipt?.terminalState === "KILLED" && activeExecution.status === "IN_PROGRESS") {
          await transitionItem(currentUser.uid, activeExecution, "KILLED", "execution-monitor");
          return;
        }
      } catch (error) {
        console.error("Execution polling failed", error);
        if (!cancelled) setAdapterError(error?.message || "Could not refresh execution state.");
      }
      if (!cancelled) timer = setTimeout(refresh, 8000);
    };

    refresh();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeExecution?.executionCommandId, activeExecution?.id, activeExecution?.status, activeExecution?.executionStatus, activeExecution?.executionTerminalState, activeExecution?.executionResultSummary, activeExecution?.executionCompletedAt, currentUser]);

  const handleTransition = async (nextStatus) => {
    if (!selected || !currentUser?.uid || busy) return;
    setBusy(true);
    setLedgerError("");
    try {
      await transitionItem(currentUser.uid, selected, nextStatus, currentUser.email || "owner");
    } catch (error) {
      console.error("Work Control transition failed", error);
      setLedgerError(error?.message || "Status transition failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleDispatch = async () => {
    if (!selected || !currentUser?.uid || busy) return;
    if (selected.status !== "READY") {
      setAdapterError("Only READY work orders can be dispatched.");
      return;
    }
    if (selected.executionCommandId) {
      setAdapterError(`This work order is already linked to ${selected.executionCommandId}.`);
      return;
    }

    setBusy(true);
    setAdapterError("");
    try {
      const response = await dispatchWorkOrder(currentUser, selected);
      const commandId = response?.command?.commandId;
      if (!commandId) throw new Error("DISPATCH_RECEIPT_MISSING_COMMAND_ID");
      await updateItemFields(currentUser.uid, selected.id, {
        executionCommandId: commandId,
        executionTeamId: response?.command?.team?.id || "SW-PROD-014",
        executionStatus: response?.command?.status || "QUEUED_GOVERNED",
        executionDispatchedAt: response?.command?.requestedAt || new Date().toISOString(),
      }, currentUser.email || "owner");
      await transitionItem(currentUser.uid, selected, "IN_PROGRESS", currentUser.email || "owner");
    } catch (error) {
      console.error("Work Control dispatch failed", error);
      setAdapterError(error?.message || "Dispatch failed.");
    } finally {
      setBusy(false);
    }
  };

  const canDispatch = Boolean(
    selected &&
    selected.status === "READY" &&
    !selected.executionCommandId &&
    ledgerState === "CONNECTED" &&
    adapterState === "READY" &&
    !busy
  );

  const nav = [
    ["overview", "Overview"],
    ["today", "Today"],
    ["queue", "Work queue"],
    ["approvals", "Approvals"],
    ["qa", "QA gates"],
    ["machines", "Machines"],
    ["history", "History"],
  ];

  return (
    <div className="wc-app">
      <aside className="wc-sidebar">
        <div className="wc-brand">
          <div className="wc-brand-mark">F</div>
          <div><strong>Factory</strong><span>Work Control</span></div>
        </div>

        <nav className="wc-nav">
          {nav.map(([key, label]) => (
            <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}>
              <Icon name={key} /><span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="wc-sidebar-foot">
          <div className={`wc-connection-dot wc-ledger-${ledgerState.toLowerCase()}`} />
          <div>
            <strong>{ledgerState === "CONNECTED" ? "Ledger connected" : ledgerState === "ERROR" ? "Ledger error" : "Connecting ledger"}</strong>
            <span>{ledgerState === "CONNECTED" ? "Firestore persistent state" : ledgerState === "ERROR" ? "Check access / rules" : "Initializing owner workspace"}</span>
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
            <div className="wc-search-wrap"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search work" /></div>
            <button className="wc-owner-button" title={currentUser?.email || "Signed-in owner"}>Owner</button>
          </div>
        </header>

        <div className={`wc-ledger-banner wc-ledger-banner-${ledgerState.toLowerCase()}`}>
          <strong>{ledgerState === "CONNECTED" && adapterState === "READY" ? "Operating mode." : ledgerState === "ERROR" || adapterState === "ERROR" ? "Connection needs attention." : "Connecting control plane."}</strong>{" "}
          {ledgerState === "CONNECTED" && adapterState === "READY"
            ? "Persistent ledger and authenticated Factory gateway are connected. READY work orders can dispatch to the governed Run 014 worker; delivered results move to QA automatically."
            : ledgerState === "ERROR"
              ? ledgerError
              : adapterState === "ERROR"
                ? adapterError || "Execution gateway unavailable."
                : "The control surface is checking persistent state and execution connectivity."}
        </div>

        {(section === "overview" || section === "today") && (
          <>
            <section className="wc-objective-card">
              <div className="wc-objective-copy">
                <div className="wc-section-kicker">PRIMARY OBJECTIVE · {objective?.id || "OBJ-001"}</div>
                <h2>{objective?.title || "Build the reusable AI production machine"}</h2>
                <p>{objective?.businessOutcome || "One dependable substrate that can run multiple commercial workloads without rebuilding core plumbing."}</p>
                <div className="wc-objective-meta">
                  <div><span>Operating manager</span><strong>{objective?.owner || "Agent 000"}</strong></div>
                  <div><span>Active milestone</span><strong>{activeMilestone?.id || "M-002"}</strong></div>
                  <div><span>Priority</span><strong>{objective?.priority || "P0"}</strong></div>
                </div>
              </div>
              <div className="wc-progress-card">
                <div className="wc-progress-number">{progress}%</div>
                <span>milestones complete</span>
                <div className="wc-progress-track"><i style={{ width: `${progress}%` }} /></div>
                <small>{doneCount} of {milestones.length || 7} milestones</small>
              </div>
            </section>

            <section className="wc-grid wc-grid-primary">
              <article className="wc-panel wc-next-panel">
                <div className="wc-panel-head">
                  <div><span className="wc-section-kicker">NEXT ACTION</span><h3>{selected?.title || "Persistent execution ledger + UI state"}</h3></div>
                  <StatusPill status={selected?.status || "READY"} />
                </div>
                <p className="wc-next-copy">{selected?.nextAction || "Verify state survives reload and record the first transition event."}</p>
                <div className="wc-next-row"><span>Current work order</span><strong>{selected?.id || "WO-002A"}</strong></div>
                <div className="wc-next-row"><span>Accountable owner</span><strong>{selected?.owner || "Run 014"}</strong></div>
                <div className="wc-next-row"><span>Definition of done</span><strong>{selected?.definitionOfDone || "Persistent state verified"}</strong></div>
                {selected?.executionCommandId && <div className="wc-next-row"><span>Execution</span><strong>{selected.executionCommandId} · {selected.executionStatus || "QUEUED"}</strong></div>}
                <button className="wc-primary-button" disabled={!canDispatch} onClick={handleDispatch} title={!canDispatch ? "Select a READY work order with connected ledger and gateway" : "Dispatch through authenticated governed queue"}>
                  {busy ? "Working…" : selected?.executionCommandId ? `Linked: ${selected.executionCommandId}` : canDispatch ? "Dispatch to governed Run 014" : "Dispatch available when READY"}
                </button>
                {adapterError && <p className="wc-action-error">{adapterError}</p>}
              </article>

              <article className="wc-panel">
                <div className="wc-panel-head">
                  <div><span className="wc-section-kicker">TODAY</span><h3>Work stack</h3></div>
                  <span className="wc-count-badge">{workOrders.length} items</span>
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
                <div><span className="wc-section-kicker">STRATEGIC SEQUENCE</span><h3>What comes next</h3></div>
                <span className="wc-muted">New ideas enter backlog by default</span>
              </div>
              <div className="wc-lane">
                {laneItems.map((item, index) => (
                  <React.Fragment key={item.id}>
                    <div className={`wc-lane-item ${item.status === "IN_PROGRESS" || item.status === "READY" ? "wc-lane-active" : item.status === "DONE" ? "wc-lane-next" : item.id === "M-007" ? "wc-lane-decision" : "wc-lane-queued"}`}>
                      <span>{item.id}</span><strong>{item.label}</strong><small>{item.status === "IN_PROGRESS" ? "NOW" : item.status === "READY" ? "READY" : item.id === "M-007" ? "DECIDE" : item.status}</small>
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
                <div><span className="wc-section-kicker">WORK QUEUE</span><h3>M-002 work orders</h3></div>
                <span className="wc-muted">WIP limit: 1 primary work order / owner</span>
              </div>
              <div className="wc-table-wrap">
                <table>
                  <thead><tr><th>ID</th><th>Work order</th><th>Owner</th><th>Priority</th><th>Status</th></tr></thead>
                  <tbody>
                    {filteredWork.map((item) => (
                      <tr key={item.id} onClick={() => setSelectedId(item.id)} className={selectedId === item.id ? "selected" : ""}>
                        <td><strong>{item.id}</strong></td><td>{item.title}</td><td>{item.owner}</td><td>{item.priority}</td><td><StatusPill status={item.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <aside className="wc-panel wc-detail-panel">
              <div className="wc-panel-head">
                <div><span className="wc-section-kicker">SELECTED WORK</span><h3>{selected?.id || "—"}</h3></div>
                <StatusPill status={selected?.status || "BACKLOG"} />
              </div>
              {selected ? (
                <>
                  <h4>{selected.title}</h4>
                  <dl>
                    <div><dt>Executor</dt><dd>{selected.executor}</dd></div>
                    <div><dt>Dependency</dt><dd>{selected.dependency}</dd></div>
                    <div><dt>Next action</dt><dd>{selected.nextAction}</dd></div>
                    <div><dt>Definition of done</dt><dd>{selected.definitionOfDone}</dd></div>
                    {selected.executionCommandId && <div><dt>Command</dt><dd>{selected.executionCommandId}</dd></div>}
                    {selected.executionStatus && <div><dt>Execution state</dt><dd>{selected.executionStatus}</dd></div>}
                    {selected.executionResultSummary && <div><dt>Execution result</dt><dd>{selected.executionResultSummary}</dd></div>}
                  </dl>
                  <div className="wc-qa-row"><span>Required QA</span><div>{(selected.qaRequired || []).map((qa) => <b key={qa}>{qa}</b>)}</div></div>
                  <div className="wc-transition-row">
                    {canDispatch && <button onClick={handleDispatch}>Dispatch to Run 014</button>}
                    {nextAllowedActions(selected.status).map(([label, target]) => (
                      <button key={target} disabled={busy || ledgerState !== "CONNECTED"} onClick={() => handleTransition(target)}>{busy ? "Saving…" : label}</button>
                    ))}
                  </div>
                </>
              ) : <p>No work order selected.</p>}
            </aside>
          </section>
        )}

        {section === "approvals" && (
          <section className="wc-panel wc-empty-state">
            <div className="wc-empty-icon">✓</div><h2>No owner approvals waiting</h2>
            <p>Strategic changes, capital commitments, material limitations, external transactions and scale decisions will appear here.</p>
          </section>
        )}

        {section === "qa" && (
          <section className="wc-grid wc-qa-grid">
            {qaDescriptions.map(([code, title, detail]) => (
              <article className="wc-panel wc-qa-card" key={code}><span>{code}</span><h3>{title}</h3><p>{detail}</p><small>Independent gate</small></article>
            ))}
          </section>
        )}

        {section === "machines" && (
          <section className="wc-grid wc-machines-grid">
            {[
              ["Work Control", "Managerial layer", "READY", "Objectives, ownership, sequencing and QA"],
              ["Persistent ledger", "State + evidence", ledgerState === "CONNECTED" ? "READY" : "BLOCKED", ledgerState === "CONNECTED" ? "Authenticated Firestore ledger connected" : "Waiting for Firestore access"],
              ["Authenticated gateway", "Factory bridge", adapterState === "READY" ? "READY" : "BLOCKED", adapterState === "READY" ? "Firebase-authenticated bounded dispatch path is reachable" : adapterError || "Checking gateway"],
              ["Governed Factory queue", "Execution", adapterState === "READY" ? "READY" : "BLOCKED", "Run 014 bounded worker queue; zero external-action authority ceiling"],
              ["n8n", "Orchestration", "READY", "Healthy nonproduction workflow engine; universal pipeline is M-003"],
            ].map(([title, kind, status, detail]) => (
              <article className="wc-panel wc-machine-card" key={title}><div className="wc-panel-head"><span className="wc-section-kicker">{kind}</span><StatusPill status={status} /></div><h3>{title}</h3><p>{detail}</p></article>
            ))}
          </section>
        )}

        {section === "history" && (
          <section className="wc-panel wc-history-panel">
            <div className="wc-panel-head"><div><span className="wc-section-kicker">EXECUTION LEDGER</span><h3>Recent state events</h3></div><span className="wc-count-badge">{events.length}</span></div>
            <div className="wc-event-list">
              {events.length ? events.map((event) => (
                <div className="wc-event" key={event.id}>
                  <span className="wc-event-type">{event.type}</span>
                  <div><strong>{event.itemId || "Factory"}</strong><p>{event.detail}</p></div>
                  <small>{formatEventTime(event.createdAt)}</small>
                </div>
              )) : <p className="wc-muted">No events recorded yet.</p>}
            </div>
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
