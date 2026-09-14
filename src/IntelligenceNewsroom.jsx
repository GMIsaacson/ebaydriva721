import React, { useMemo, useState } from "react";
import "./intelligence-newsroom.css";

const categories = ["Top stories", "Markets", "Trade", "Energy", "Agriculture", "Technology", "Infrastructure", "Policy"];

const stories = [
  {
    id: "evt-001",
    category: "Trade",
    location: "East Africa",
    title: "Regional trade corridor changes could cut landed costs for selected import categories",
    summary: "The newsroom has grouped policy, port and logistics reporting into one event cluster and identified the industries most exposed to the change.",
    sources: ["Reuters", "Business Daily", "Port Authority", "+5"],
    freshness: "18 min ago",
    confidence: 94,
    impact: "High",
    opportunity: "Import substitution / distribution",
    why: "Lower landed costs can alter distributor margins before retail pricing adjusts.",
    action: "Map HS codes → active importers → local price spread",
    tone: "blue",
  },
  {
    id: "evt-002",
    category: "Energy",
    location: "Kenya",
    title: "Grid and storage investment accelerates as industrial power demand rises",
    summary: "Multiple reports point to a near-term procurement cycle across storage, controls and industrial power equipment.",
    sources: ["Energy Ministry", "The EastAfrican", "Company filings", "+4"],
    freshness: "42 min ago",
    confidence: 90,
    impact: "High",
    opportunity: "Supplier / contractor intelligence",
    why: "Projects create purchase orders before they show up in broad economic statistics.",
    action: "Extract projects → contractors → equipment categories",
    tone: "amber",
  },
  {
    id: "evt-003",
    category: "Agriculture",
    location: "Kenya",
    title: "Produce price dispersion widens between major growing regions and Nairobi",
    summary: "Wholesale price signals show a widening regional spread that may support short-haul trading opportunities after transport and spoilage costs.",
    sources: ["Market bulletins", "County feeds", "Trader reports", "+6"],
    freshness: "1 hr ago",
    confidence: 86,
    impact: "Medium",
    opportunity: "Trade route probe",
    why: "Price spread is meaningful only after route economics and buyer depth are verified.",
    action: "Run CI-001 local market adapter",
    tone: "green",
  },
  {
    id: "evt-004",
    category: "Technology",
    location: "Africa",
    title: "AI infrastructure spending shifts from pilots toward operating workloads",
    summary: "Cloud, data-center and enterprise announcements suggest a change in buying behavior from experimentation to recurring deployment.",
    sources: ["Company releases", "TechCabal", "Bloomberg", "+8"],
    freshness: "2 hrs ago",
    confidence: 91,
    impact: "Medium",
    opportunity: "B2B services / infrastructure",
    why: "Recurring workloads create demand for integration, monitoring and vertical applications.",
    action: "Send to Opportunity Portfolio Steward",
    tone: "violet",
  },
  {
    id: "evt-005",
    category: "Infrastructure",
    location: "East Africa",
    title: "New transport projects reshape commercial catchment areas around secondary cities",
    summary: "Road and logistics projects are being connected to land, warehousing, retail and agricultural flow implications.",
    sources: ["Government notices", "Local press", "Tender data", "+7"],
    freshness: "3 hrs ago",
    confidence: 88,
    impact: "High",
    opportunity: "Land / logistics / services",
    why: "Accessibility changes can move economic activity before formal investment reports catch up.",
    action: "Generate corridor opportunity map",
    tone: "slate",
  },
];

const briefs = [
  { label: "FX", value: "KES volatility", note: "Watch importer margins" },
  { label: "PORTS", value: "Mombasa flow", note: "3 sectors accelerating" },
  { label: "FOOD", value: "Regional spread", note: "2 trade probes active" },
  { label: "TECH", value: "AI spend", note: "Enterprise demand rising" },
];

function SourceStack({ sources }) {
  return (
    <div className="ain-source-stack" aria-label="sources">
      {sources.map((source, index) => (
        <span key={source} className={index === sources.length - 1 ? "more" : ""}>{source}</span>
      ))}
    </div>
  );
}

function IntelligenceNewsroom() {
  const [activeCategory, setActiveCategory] = useState("Top stories");
  const [selected, setSelected] = useState(stories[0]);
  const [mode, setMode] = useState("Newsroom");

  const visibleStories = useMemo(() => {
    if (activeCategory === "Top stories") return stories;
    return stories.filter((story) => story.category === activeCategory);
  }, [activeCategory]);

  return (
    <div className="ain-page">
      <header className="ain-header">
        <div className="ain-header-inner">
          <a className="ain-brand" href="/intelligence-news" aria-label="Autonomous Intelligence Newsroom home">
            <span className="ain-brand-mark">A</span>
            <span>
              <strong>Atlas Intelligence</strong>
              <small>Autonomous Newsroom Prototype</small>
            </span>
          </a>
          <div className="ain-search">
            <span>⌕</span>
            <input aria-label="Search intelligence" placeholder="Search events, companies, sectors, countries..." />
            <kbd>⌘ K</kbd>
          </div>
          <div className="ain-header-actions">
            <span className="ain-live"><i /> LIVE</span>
            <button className="ain-icon-button" title="Notifications">◔</button>
            <div className="ain-avatar">000</div>
          </div>
        </div>
      </header>

      <nav className="ain-tabs" aria-label="News categories">
        <div className="ain-tabs-inner">
          {categories.map((category) => (
            <button
              key={category}
              className={activeCategory === category ? "active" : ""}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </nav>

      <main className="ain-main">
        <section className="ain-intro">
          <div>
            <div className="ain-kicker">AFRICA BUSINESS & ECONOMIC INTELLIGENCE</div>
            <h1>What happened. Why it matters. What to do next.</h1>
            <p>Stories are clustered into events, corroborated across sources, ranked by economic significance, and converted into actionable intelligence.</p>
          </div>
          <div className="ain-mode-toggle" aria-label="View mode">
            {["Newsroom", "Intelligence", "Opportunities"].map((item) => (
              <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}</button>
            ))}
          </div>
        </section>

        <section className="ain-ticker-grid">
          {briefs.map((item) => (
            <article key={item.label} className="ain-ticker-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.note}</small>
            </article>
          ))}
        </section>

        <section className="ain-layout">
          <div className="ain-feed">
            <div className="ain-section-heading">
              <div>
                <span className="ain-pulse-dot" />
                <h2>{activeCategory}</h2>
              </div>
              <span>Ranked by significance × freshness × corroboration</span>
            </div>

            {visibleStories.length === 0 && (
              <div className="ain-empty">No prototype events in this category yet.</div>
            )}

            {visibleStories.map((story, index) => (
              <article
                key={story.id}
                className={`ain-story ${selected.id === story.id ? "selected" : ""}`}
                onClick={() => setSelected(story)}
              >
                <div className={`ain-story-visual tone-${story.tone}`}>
                  <span>{story.category}</span>
                  <strong>{String(index + 1).padStart(2, "0")}</strong>
                  <small>{story.location}</small>
                </div>
                <div className="ain-story-body">
                  <div className="ain-story-meta">
                    <span>{story.category}</span>
                    <span>•</span>
                    <span>{story.location}</span>
                    <span>•</span>
                    <span>{story.freshness}</span>
                  </div>
                  <h3>{story.title}</h3>
                  <p>{story.summary}</p>
                  <div className="ain-story-footer">
                    <SourceStack sources={story.sources} />
                    <div className="ain-confidence">
                      <span>{story.confidence}% corroborated</span>
                      <div><i style={{ width: `${story.confidence}%` }} /></div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="ain-rail">
            <div className="ain-panel ain-event-panel">
              <div className="ain-panel-label">SELECTED EVENT</div>
              <h3>{selected.title}</h3>
              <div className="ain-event-id">{selected.id.toUpperCase()} · {selected.sources.length + 4} linked reports</div>
              <div className="ain-detail-block">
                <span>WHY IT MATTERS</span>
                <p>{selected.why}</p>
              </div>
              <div className="ain-detail-block opportunity">
                <span>OPPORTUNITY SIGNAL</span>
                <strong>{selected.opportunity}</strong>
                <p>{selected.action}</p>
              </div>
              <button className="ain-primary-button">Open intelligence brief →</button>
            </div>

            <div className="ain-panel ain-factory-panel">
              <div className="ain-panel-heading-row">
                <div>
                  <div className="ain-panel-label">FACTORY AUTONOMY</div>
                  <h3>Newsroom operator</h3>
                </div>
                <span className="ain-status">L2 DEMO</span>
              </div>
              <div className="ain-pipeline">
                {[
                  ["Collect", "active"],
                  ["Cluster", "active"],
                  ["Verify", "active"],
                  ["Rank", "active"],
                  ["Explain", "active"],
                  ["Opportunity", "queued"],
                ].map(([name, state]) => (
                  <div key={name} className={state}>
                    <i />
                    <span>{name}</span>
                  </div>
                ))}
              </div>
              <div className="ain-run-stats">
                <div><strong>128</strong><span>sources watched</span></div>
                <div><strong>43</strong><span>events clustered</span></div>
                <div><strong>7</strong><span>signals escalated</span></div>
              </div>
              <small className="ain-demo-note">Prototype metrics shown for UI evaluation; live ingestion is the next implementation layer.</small>
            </div>
          </aside>
        </section>

        <section className="ain-opportunity-strip">
          <div>
            <span className="ain-panel-label">THE DIFFERENTIATOR</span>
            <h2>News → Event → Economic significance → Opportunity → Factory action</h2>
          </div>
          <div className="ain-flow">
            {["NEWS", "EVENT", "IMPACT", "OPPORTUNITY", "ACTION"].map((step, index) => (
              <React.Fragment key={step}>
                <span>{step}</span>
                {index < 4 && <b>→</b>}
              </React.Fragment>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default IntelligenceNewsroom;
