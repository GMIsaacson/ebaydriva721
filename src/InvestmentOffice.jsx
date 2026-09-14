import React, { useMemo, useState } from "react";
import "./investment-office.css";

const agents = [
  { id: "INV-000", name: "Investment Director", role: "Synthesis, decision memo, sequencing", state: "READY" },
  { id: "INV-01", name: "Business Analyst", role: "Business quality, moat, unit economics", state: "READY" },
  { id: "INV-02", name: "Valuation Analyst", role: "DCF, multiples, SOTP, scenario valuation", state: "READY" },
  { id: "INV-03", name: "Bear / Red Team", role: "Attack thesis, expose failure modes", state: "READY" },
  { id: "INV-04", name: "Market & Catalyst", role: "Catalysts, timing, positioning, macro", state: "READY" },
  { id: "INV-05", name: "Portfolio & Risk", role: "Sizing, concentration, correlation, drawdown", state: "READY" },
  { id: "INV-06", name: "Long-Horizon Scout", role: "5–15 year asymmetric opportunity search", state: "READY" },
  { id: "INV-07", name: "Monitor", role: "Filings, news, prices, thesis-change detection", state: "READY" },
];

const watchlist = [
  { ticker: "SPCX", name: "SpaceX", score: 86, thesis: "Launch + connectivity + defense + Starship optionality", status: "ACCUMULATE", confidence: "HIGH" },
  { ticker: "GOOGL", name: "Alphabet", score: 82, thesis: "AI distribution + search cash engine + cloud", status: "WATCH", confidence: "HIGH" },
  { ticker: "AMZN", name: "Amazon", score: 80, thesis: "AWS + logistics + ads + AI infrastructure", status: "WATCH", confidence: "HIGH" },
  { ticker: "NVDA", name: "NVIDIA", score: 79, thesis: "AI compute platform with exceptional economics", status: "VALUATION CHECK", confidence: "HIGH" },
];

const researchQueue = [
  { id: "IR-001", asset: "SpaceX", owner: "INV-000", stage: "COMMITTEE REVIEW", next: "Refresh valuation + red-team thesis", priority: "P0" },
  { id: "IR-002", asset: "Alphabet", owner: "INV-02", stage: "VALUATION", next: "Update 2031 base/bull/bear", priority: "P1" },
  { id: "IR-003", asset: "Amazon", owner: "INV-01", stage: "BUSINESS QUALITY", next: "Normalize AWS + retail FCF", priority: "P1" },
  { id: "IR-004", asset: "Opportunity Radar", owner: "INV-06", stage: "SCOUTING", next: "Find score > current leader", priority: "P1" },
];

const spacex = {
  ticker: "SPCX",
  decision: "ACCUMULATE",
  horizon: "10–15 years",
  score: 86,
  confidence: 78,
  targetWeight: "3–5% initial target",
  dca: "Valuation-aware DCA",
  marketFeed: "LIVE FEED ADAPTER PENDING",
  thesis: "SpaceX combines launch infrastructure, Starlink recurring connectivity, government/defense relationships and Starship-driven cost optionality in one vertically integrated platform.",
  bull: "Starlink expands margins and ARPU while Starship achieves reliable rapid reuse, opening new orbital markets.",
  bear: "Current valuation outruns cash generation; Starship development, regulation, capex or execution delays compress future returns.",
  kill: [
    "Sustained deterioration in Starlink subscriber economics or churn",
    "Starship fails to reach economically useful reuse within the thesis window",
    "Governance/capital allocation materially impairs minority shareholder economics",
    "Valuation rises enough that expected 10-year return falls below portfolio hurdle rate",
  ],
};

function ScoreRing({ value }) {
  return (
    <div className="fio-score-ring" style={{ "--score": `${value * 3.6}deg` }}>
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

export default function InvestmentOffice() {
  const [section, setSection] = useState("overview");
  const [committeeState, setCommitteeState] = useState("READY");
  const [approval, setApproval] = useState("LOCKED");

  const averageScore = useMemo(() => Math.round(watchlist.reduce((sum, row) => sum + row.score, 0) / watchlist.length), []);

  const queueCommittee = () => {
    setCommitteeState("QUEUED");
    window.setTimeout(() => setCommitteeState("STAGED — EXECUTION ADAPTER NEXT"), 650);
  };

  const renderOverview = () => (
    <>
      <section className="fio-metrics-grid">
        <div className="fio-metric"><span>Investment candidates</span><strong>{watchlist.length}</strong><small>ranked watchlist</small></div>
        <div className="fio-metric"><span>Research queue</span><strong>{researchQueue.length}</strong><small>1 P0 committee review</small></div>
        <div className="fio-metric"><span>Committee agents</span><strong>{agents.length}</strong><small>independent mandates</small></div>
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
          <div className="fio-gate">
            <span>Autonomous trading</span><strong>DISABLED</strong>
          </div>
          <div className="fio-gate">
            <span>Research autonomy</span><strong>ENABLED</strong>
          </div>
          <div className="fio-gate">
            <span>Capital action</span><strong>OWNER ONLY</strong>
          </div>
          <button className="fio-secondary fio-full" onClick={() => setApproval(approval === "LOCKED" ? "REVIEW MODE" : "LOCKED")}>Toggle review mode</button>
        </article>
      </section>

      <section className="fio-card">
        <div className="fio-card-head compact"><div><span className="fio-eyebrow">RANKED WATCHLIST</span><h3>Best opportunities currently under review</h3></div><button className="fio-link" onClick={() => setSection("watchlist")}>View all →</button></div>
        <div className="fio-table-wrap"><table className="fio-table"><thead><tr><th>Rank</th><th>Asset</th><th>Score</th><th>Decision</th><th>Core thesis</th></tr></thead><tbody>{watchlist.map((row, index) => <tr key={row.ticker}><td>#{index + 1}</td><td><strong>{row.ticker}</strong><span>{row.name}</span></td><td><strong>{row.score}</strong>/100</td><td><Pill tone={row.status === "ACCUMULATE" ? "green" : "neutral"}>{row.status}</Pill></td><td>{row.thesis}</td></tr>)}</tbody></table></div>
      </section>
    </>
  );

  const renderWatchlist = () => (
    <section className="fio-card">
      <div className="fio-card-head"><div><span className="fio-eyebrow">WATCHLIST</span><h2>Investment opportunity stack</h2></div><Pill>{watchlist.length} assets</Pill></div>
      <div className="fio-watch-grid">{watchlist.map((row, index) => <article key={row.ticker} className="fio-watch-card"><div><span className="fio-rank">#{index + 1}</span><h3>{row.ticker}</h3><small>{row.name}</small></div><strong className="fio-watch-score">{row.score}</strong><p>{row.thesis}</p><div className="fio-inline-pills"><Pill tone={row.status === "ACCUMULATE" ? "green" : "neutral"}>{row.status}</Pill><Pill>{row.confidence}</Pill></div></article>)}</div>
    </section>
  );

  const renderQueue = () => (
    <section className="fio-card">
      <div className="fio-card-head"><div><span className="fio-eyebrow">RESEARCH QUEUE</span><h2>Committee work orders</h2></div><Pill tone="green">FACTORY READY</Pill></div>
      <div className="fio-queue">{researchQueue.map((row) => <div className="fio-queue-row" key={row.id}><div><strong>{row.id}</strong><span>{row.priority}</span></div><div><strong>{row.asset}</strong><span>{row.owner}</span></div><div><strong>{row.stage}</strong><span>{row.next}</span></div><button className="fio-secondary">Inspect</button></div>)}</div>
    </section>
  );

  const renderAgents = () => (
    <section className="fio-card">
      <div className="fio-card-head"><div><span className="fio-eyebrow">INVESTMENT COMMITTEE</span><h2>Independent specialist agents</h2></div><Pill>{agents.length} agents</Pill></div>
      <div className="fio-agent-grid">{agents.map((agent) => <article className="fio-agent" key={agent.id}><div className="fio-agent-id">{agent.id}</div><h3>{agent.name}</h3><p>{agent.role}</p><Pill tone="green">{agent.state}</Pill></article>)}</div>
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
        <div className="fio-memo-section"><h3>Kill criteria</h3><ul>{spacex.kill.map((item) => <li key={item}>{item}</li>)}</ul></div>
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
      <div className="fio-card-head"><div><span className="fio-eyebrow">OPPORTUNITY RADAR</span><h2>Beat the current leader</h2></div><Pill tone="amber">SCOUTING</Pill></div>
      <div className="fio-radar-target"><span>Current hurdle</span><strong>Score &gt; {watchlist[0].score}</strong><p>INV-06 searches for assets with a better long-horizon risk-adjusted opportunity than the current #1 candidate, then sends survivors through valuation and red-team review.</p></div>
      <div className="fio-pipeline"><span>UNIVERSE</span><b>→</b><span>SCREEN</span><b>→</b><span>RESEARCH</span><b>→</b><span>VALUATION</span><b>→</b><span>RED TEAM</span><b>→</b><span>PORTFOLIO FIT</span><b>→</b><span>INV-000</span></div>
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
        <header className="fio-topbar"><div><span className="fio-eyebrow">FACTORY / INVESTMENT INTELLIGENCE</span><h1>{section === "overview" ? "Investment Office" : section.replaceAll("-", " ")}</h1></div><div className="fio-top-actions"><Pill tone="green">SYSTEM READY</Pill><a href="/factory-control" className="fio-secondary fio-anchor">Factory Control</a></div></header>
        {renderSection()}
      </main>
    </div>
  );
}
