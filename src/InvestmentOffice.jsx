import React, { useEffect, useMemo, useState } from "react";
import { fallbackFio, subscribeFio } from "./fioLedger";
import "./investment-office.css";

function ScoreRing({ value = 0 }) {
  return (
    <div className="fio-score-ring" style={{ "--score": `${Number(value || 0) * 3.6}deg` }}>
      <div><strong>{value}</strong><span>/100</span></div>
    </div>
  );
}

function Pill({ children, tone = "neutral" }) {
  return <span className={`fio-pill fio-pill-${tone}`}>{children}</span>;
}

function NavButton({ active, onClick, children }) {
  return <button className={`fio-nav-button ${active ? "active" : ""}`} onClick={onClick}>{children}</button>;
}

function formatRunTime(value) {
  if (!value) return "not run yet";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
}

export default function InvestmentOffice() {
  const [section, setSection] = useState("overview");
  const [committeeState, setCommitteeState] = useState("READY");
  const [approval, setApproval] = useState("LOCKED");
  const [fio, setFio] = useState(fallbackFio);
  const [firebaseState, setFirebaseState] = useState("CONNECTING");
  const [firebaseError, setFirebaseError] = useState("");

  useEffect(() => {
    const stop = subscribeFio(
      setFio,
      (status) => {
        setFirebaseState(status.state);
        if (status.error) setFirebaseError(status.error);
      }
    );
    return stop;
  }, []);

  const agents = fio.agents?.length ? fio.agents : fallbackFio.agents;
  const watchlist = fio.assets?.length ? fio.assets : fallbackFio.assets;
  const researchQueue = fio.queue?.length ? fio.queue : fallbackFio.queue;
  const spacex = fio.memos?.SPCX || fallbackFio.memos.SPCX;
  const opportunities = fio.opportunities || [];
  const alerts = fio.alerts || [];
  const runs = fio.runs || [];
  const meta = fio.meta || fallbackFio.meta;

  const averageScore = useMemo(() => {
    if (!watchlist.length) return 0;
    return Math.round(watchlist.reduce((sum, row) => sum + Number(row.score || 0), 0) / watchlist.length);
  }, [watchlist]);

  const latestRun = (workflow) => runs.find((run) => run.workflow === workflow || run.type === workflow);
  const monitorRun = latestRun("FIO-MONITOR");
  const dailyRun = latestRun("FIO-DAILY");
  const radarRun = latestRun("FIO-RADAR");
  const committeeRun = latestRun("FIO-COMMITTEE");

  const queueCommittee = () => {
    setCommitteeState("REQUEST STAGED");
    window.setTimeout(() => setCommitteeState("N8N EXECUTION ADAPTER REQUIRED"), 700);
  };

  const renderRuntime = () => (
    <section className="fio-card">
      <div className="fio-card-head compact">
        <div><span className="fio-eyebrow">AUTONOMOUS RUNTIME</span><h3>Daily + event-driven operating loops</h3></div>
        <Pill tone={firebaseState === "CONNECTED" ? "green" : "amber"}>FIREBASE {firebaseState}</Pill>
      </div>
      <div className="fio-queue">
        <div className="fio-queue-row"><div><strong>FIO-MONITOR</strong><span>event-driven / frequent</span></div><div><strong>{monitorRun?.status || "NOT RUN"}</strong><span>portfolio + watchlist changes</span></div><div><strong>{formatRunTime(monitorRun?.completedAt || monitorRun?.startedAt || meta.lastMonitorRun)}</strong><span>last execution</span></div><Pill tone={monitorRun ? "green" : "amber"}>{monitorRun ? "ACTIVE HISTORY" : "WIRE NEXT"}</Pill></div>
        <div className="fio-queue-row"><div><strong>FIO-DAILY</strong><span>daily brief</span></div><div><strong>{dailyRun?.status || "NOT RUN"}</strong><span>thesis + valuation review</span></div><div><strong>{formatRunTime(dailyRun?.completedAt || dailyRun?.startedAt || meta.lastDailyRun)}</strong><span>last execution</span></div><Pill tone={dailyRun ? "green" : "amber"}>{dailyRun ? "ACTIVE HISTORY" : "WIRE NEXT"}</Pill></div>
        <div className="fio-queue-row"><div><strong>FIO-RADAR</strong><span>daily discovery</span></div><div><strong>{radarRun?.status || "NOT RUN"}</strong><span>new opportunity search</span></div><div><strong>{formatRunTime(radarRun?.completedAt || radarRun?.startedAt || meta.lastRadarRun)}</strong><span>last execution</span></div><Pill tone={radarRun ? "green" : "amber"}>{radarRun ? "ACTIVE HISTORY" : "WIRE NEXT"}</Pill></div>
        <div className="fio-queue-row"><div><strong>FIO-COMMITTEE</strong><span>deep research</span></div><div><strong>{committeeRun?.status || "NOT RUN"}</strong><span>INV-01 → INV-07 → INV-000</span></div><div><strong>{formatRunTime(committeeRun?.completedAt || committeeRun?.startedAt || meta.lastCommitteeRun)}</strong><span>last execution</span></div><Pill tone={committeeRun ? "green" : "amber"}>{committeeRun ? "ACTIVE HISTORY" : "WIRE NEXT"}</Pill></div>
      </div>
      {firebaseError && <div className="fio-runtime-note">Firebase read status: <strong>{firebaseError}</strong>. The UI is using its safe local seed until rules/data are deployed.</div>}
    </section>
  );

  const renderOverview = () => (
    <>
      <section className="fio-metrics-grid">
        <div className="fio-metric"><span>Investment candidates</span><strong>{watchlist.length}</strong><small>ranked watchlist</small></div>
        <div className="fio-metric"><span>Research queue</span><strong>{researchQueue.length}</strong><small>{researchQueue.filter((row) => row.priority === "P0").length} P0 items</small></div>
        <div className="fio-metric"><span>New opportunities</span><strong>{opportunities.length}</strong><small>Firebase radar survivors</small></div>
        <div className="fio-metric"><span>Watchlist quality</span><strong>{averageScore}</strong><small>average score / 100</small></div>
      </section>

      <section className="fio-grid fio-grid-main">
        <article className="fio-card fio-hero-card">
          <div className="fio-card-head">
            <div>
              <span className="fio-eyebrow">FIRST LIVE CASE</span>
              <h2>SpaceX <span>SPCX</span></h2>
            </div>
            <ScoreRing value={spacex.score} />
          </div>
          <p className="fio-thesis">{spacex.thesis}</p>
          <div className="fio-inline-pills">
            <Pill tone="green">{spacex.decision}</Pill>
            <Pill>{spacex.horizon}</Pill>
            <Pill>{spacex.dca}</Pill>
          </div>
          <div className="fio-fact-grid">
            <div><span>Confidence</span><strong>{spacex.confidence}%</strong></div>
            <div><span>Target exposure</span><strong>{spacex.targetWeight}</strong></div>
            <div><span>Market data</span><strong className="fio-small-strong">{spacex.marketFeed}</strong></div>
          </div>
          <div className="fio-action-row">
            <button className="fio-primary" onClick={queueCommittee}>Run investment committee</button>
            <button className="fio-secondary" onClick={() => setSection("memo")}>Open investment memo</button>
          </div>
          <div className="fio-runtime-note">Committee state: <strong>{committeeState}</strong></div>
        </article>

        <article className="fio-card">
          <div className="fio-card-head compact">
            <div><span className="fio-eyebrow">CAPITAL CONTROL</span><h3>Owner approval gate</h3></div>
            <Pill tone={approval === "LOCKED" ? "amber" : "green"}>{approval}</Pill>
          </div>
          <p>Agents may research, score, debate, monitor and recommend. They cannot place or authorize a trade.</p>
          <div className="fio-gate"><span>Autonomous trading</span><strong>DISABLED</strong></div>
          <div className="fio-gate"><span>Research autonomy</span><strong>ENABLED</strong></div>
          <div className="fio-gate"><span>Capital action</span><strong>OWNER ONLY</strong></div>
          <button className="fio-secondary fio-full" onClick={() => setApproval(approval === "LOCKED" ? "REVIEW MODE" : "LOCKED")}>Toggle review mode</button>
        </article>
      </section>

      {renderRuntime()}

      <section className="fio-card">
        <div className="fio-card-head compact"><div><span className="fio-eyebrow">RANKED WATCHLIST</span><h3>Best opportunities currently under review</h3></div><button className="fio-link" onClick={() => setSection("watchlist")}>View all →</button></div>
        <div className="fio-table-wrap"><table className="fio-table"><thead><tr><th>Rank</th><th>Asset</th><th>Score</th><th>Decision</th><th>Core thesis</th></tr></thead><tbody>{watchlist.map((row, index) => <tr key={row.ticker || row.id}><td>#{row.rank || index + 1}</td><td><strong>{row.ticker}</strong><span>{row.name}</span></td><td><strong>{row.score}</strong>/100</td><td><Pill tone={row.status === "ACCUMULATE" ? "green" : "neutral"}>{row.status}</Pill></td><td>{row.thesis}</td></tr>)}</tbody></table></div>
      </section>

      {alerts.length > 0 && <section className="fio-card"><div className="fio-card-head compact"><div><span className="fio-eyebrow">MATERIAL ALERTS</span><h3>Changes that deserve attention</h3></div><Pill tone="amber">{alerts.length} OPEN</Pill></div><div className="fio-queue">{alerts.slice(0, 5).map((row) => <div className="fio-queue-row" key={row.id}><div><strong>{row.asset || row.ticker || "Portfolio"}</strong><span>{row.severity || "INFO"}</span></div><div><strong>{row.title || row.type || "Material change"}</strong><span>{row.summary || row.detail}</span></div><div><strong>{row.recommendation || "REVIEW"}</strong><span>{formatRunTime(row.createdAt)}</span></div><Pill tone="amber">ALERT</Pill></div>)}</div></section>}
    </>
  );

  const renderWatchlist = () => (
    <section className="fio-card">
      <div className="fio-card-head"><div><span className="fio-eyebrow">WATCHLIST</span><h2>Investment opportunity stack</h2></div><Pill>{watchlist.length} assets</Pill></div>
      <div className="fio-watch-grid">{watchlist.map((row, index) => <article key={row.ticker || row.id} className="fio-watch-card"><div><span className="fio-rank">#{row.rank || index + 1}</span><h3>{row.ticker}</h3><small>{row.name}</small></div><strong className="fio-watch-score">{row.score}</strong><p>{row.thesis}</p><div className="fio-inline-pills"><Pill tone={row.status === "ACCUMULATE" ? "green" : "neutral"}>{row.status}</Pill><Pill>{row.confidence}</Pill></div></article>)}</div>
    </section>
  );

  const renderQueue = () => (
    <section className="fio-card">
      <div className="fio-card-head"><div><span className="fio-eyebrow">RESEARCH QUEUE</span><h2>Committee work orders</h2></div><Pill tone="green">FIREBASE MODEL READY</Pill></div>
      <div className="fio-queue">{researchQueue.map((row) => <div className="fio-queue-row" key={row.id}><div><strong>{row.id}</strong><span>{row.priority}</span></div><div><strong>{row.asset}</strong><span>{row.owner}</span></div><div><strong>{row.stage}</strong><span>{row.next}</span></div><button className="fio-secondary">Inspect</button></div>)}</div>
    </section>
  );

  const renderAgents = () => (
    <section className="fio-card">
      <div className="fio-card-head"><div><span className="fio-eyebrow">INVESTMENT COMMITTEE</span><h2>Independent specialist agents</h2></div><Pill>{agents.length} agents</Pill></div>
      <div className="fio-agent-grid">{agents.map((agent) => <article className="fio-agent" key={agent.id}><div className="fio-agent-id">{agent.id}</div><h3>{agent.name}</h3><p>{agent.role}</p><Pill tone={agent.state === "ERROR" ? "amber" : "green"}>{agent.state || "READY"}</Pill></article>)}</div>
    </section>
  );

  const renderMemo = () => (
    <section className="fio-grid fio-grid-main">
      <article className="fio-card fio-memo">
        <span className="fio-eyebrow">LIVING INVESTMENT MEMO</span><h2>SpaceX / SPCX</h2>
        <div className="fio-memo-section"><h3>Committee position</h3><p><strong>{spacex.decision}</strong> · {spacex.horizon} · {spacex.targetWeight} · {spacex.dca}</p></div>
        <div className="fio-memo-section"><h3>Base thesis</h3><p>{spacex.thesis}</p></div>
        <div className="fio-memo-section"><h3>Bull case</h3><p>{spacex.bull}</p></div>
        <div className="fio-memo-section"><h3>Bear case</h3><p>{spacex.bear}</p></div>
        <div className="fio-memo-section"><h3>Kill criteria</h3><ul>{(spacex.kill || []).map((item) => <li key={item}>{item}</li>)}</ul></div>
      </article>
      <article className="fio-card">
        <span className="fio-eyebrow">COMMITTEE DEBATE</span><h3>Required dissent</h3>
        <div className="fio-debate"><strong>INV-01 · Business</strong><p>Exceptional strategic position; recurring connectivity makes the thesis less dependent on launch alone.</p></div>
        <div className="fio-debate"><strong>INV-02 · Valuation</strong><p>Business quality does not remove valuation risk. Required return must be recalculated as market value changes.</p></div>
        <div className="fio-debate"><strong>INV-03 · Bear</strong><p>Starship timelines, capex intensity and governance concentration must remain explicit failure modes.</p></div>
        <div className="fio-debate"><strong>INV-05 · Risk</strong><p>Size the initial position so a severe drawdown does not impair the broader portfolio.</p></div>
      </article>
    </section>
  );

  const renderRadar = () => (
    <section className="fio-card">
      <div className="fio-card-head"><div><span className="fio-eyebrow">OPPORTUNITY RADAR</span><h2>Beat the current leader</h2></div><Pill tone={opportunities.length ? "green" : "amber"}>{opportunities.length ? `${opportunities.length} SURVIVORS` : "AWAITING FIRST RUN"}</Pill></div>
      <div className="fio-radar-target"><span>Current hurdle</span><strong>Score &gt; {watchlist[0]?.score || 0}</strong><p>INV-06 searches for assets with a better long-horizon risk-adjusted opportunity than the current #1 candidate, then sends survivors through valuation and red-team review.</p></div>
      <div className="fio-pipeline"><span>UNIVERSE</span><b>→</b><span>SCREEN</span><b>→</b><span>RESEARCH</span><b>→</b><span>VALUATION</span><b>→</b><span>RED TEAM</span><b>→</b><span>PORTFOLIO FIT</span><b>→</b><span>INV-000</span></div>
      {opportunities.length > 0 && <div className="fio-queue">{opportunities.slice(0, 10).map((row, index) => <div className="fio-queue-row" key={row.id}><div><strong>#{index + 1} {row.ticker || row.asset}</strong><span>{row.stage || "SURVIVOR"}</span></div><div><strong>{row.score || "—"}/100</strong><span>{row.confidence || "UNRATED"}</span></div><div><strong>{row.thesis || row.title}</strong><span>{row.next || "Send to committee"}</span></div><Pill tone="green">RADAR</Pill></div>)}</div>}
    </section>
  );

  const renderSection = () => {
    if (section === "watchlist") return renderWatchlist();
    if (section === "queue") return renderQueue();
    if (section === "agents") return renderAgents();
    if (section === "memo") return renderMemo();
    if (section === "radar") return renderRadar();
    return renderOverview();
  };

  return (
    <div className="fio-shell">
      <aside className="fio-sidebar">
        <div className="fio-brand"><span>FIO</span><div><strong>Factory Investment Office</strong><small>Investment Intelligence</small></div></div>
        <nav>
          <NavButton active={section === "overview"} onClick={() => setSection("overview")}>Overview</NavButton>
          <NavButton active={section === "watchlist"} onClick={() => setSection("watchlist")}>Watchlist</NavButton>
          <NavButton active={section === "radar"} onClick={() => setSection("radar")}>Opportunity Radar</NavButton>
          <NavButton active={section === "queue"} onClick={() => setSection("queue")}>Research Queue</NavButton>
          <NavButton active={section === "memo"} onClick={() => setSection("memo")}>Investment Memo</NavButton>
          <NavButton active={section === "agents"} onClick={() => setSection("agents")}>Agent Committee</NavButton>
        </nav>
        <div className="fio-sidebar-foot"><span className="fio-dot"></span><div><strong>Research autonomous</strong><small>Trades require owner approval</small></div></div>
      </aside>
      <main className="fio-main">
        <header className="fio-topbar"><div><span className="fio-eyebrow">FACTORY / INVESTMENT INTELLIGENCE</span><h1>{section === "overview" ? "Investment Office" : section.replaceAll("-", " ")}</h1></div><div className="fio-top-actions"><Pill tone={firebaseState === "CONNECTED" ? "green" : "amber"}>{firebaseState === "CONNECTED" ? "FIREBASE LIVE" : "SAFE FALLBACK"}</Pill><a href="/factory-control" className="fio-secondary fio-anchor">Factory Control</a></div></header>
        {renderSection()}
      </main>
    </div>
  );
}
