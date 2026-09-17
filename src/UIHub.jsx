import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import registry from "../agent-factory/governance/ui-registry-v1.json";
import directionRegistry from "../agent-factory/governance/project-direction-registry-v1.json";
import "./ui-hub.css";

const PIN_KEY = "factory-ui-hub-pins-v1";
const RECENT_KEY = "factory-ui-hub-recent-v1";
const STAGES = directionRegistry.stages || ["DISCOVER", "VALIDATE", "BUILD", "PILOT", "PROVE", "SCALE"];
const DIRECTION_BY_UI = new Map((directionRegistry.projects || []).map((project) => [project.uiProjectId, project]));

function readStored(key, fallback) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function lifecycleClass(value = "") {
  return `uih-pill uih-life-${String(value).toLowerCase()}`;
}

function healthClass(value = "") {
  return `uih-pill uih-health-${String(value).toLowerCase()}`;
}

function freshnessClass(value = "") {
  return `uih-pill uih-fresh-${String(value).toLowerCase()}`;
}

function manageUrl(project) {
  return `https://vercel.com/${registry.team.teamSlug}/${project.vercelProjectName}`;
}

function repoUrl(repo) {
  return repo ? `https://github.com/${repo}` : null;
}

function StageRail({ phase }) {
  const currentIndex = STAGES.indexOf(phase);
  return (
    <div className="uih-stage-rail" aria-label={`Current project phase: ${phase || "unknown"}`}>
      {STAGES.map((stage, index) => {
        const state = currentIndex < 0 ? "future" : index < currentIndex ? "done" : index === currentIndex ? "current" : "future";
        return (
          <React.Fragment key={stage}>
            <div className={`uih-stage uih-stage-${state}`}>
              <span className="uih-stage-dot">{state === "done" ? "✓" : state === "current" ? "●" : "○"}</span>
              <span>{stage}</span>
            </div>
            {index < STAGES.length - 1 && <span className={`uih-stage-line ${state === "done" ? "done" : ""}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function TextList({ items, empty = "None recorded." }) {
  if (!Array.isArray(items) || items.length === 0) return <p className="uih-empty-copy">{empty}</p>;
  return (
    <ul className="uih-direction-list">
      {items.map((item, index) => <li key={`${index}-${String(item).slice(0, 24)}`}>{item}</li>)}
    </ul>
  );
}

function DirectionDetails({ direction }) {
  const ownerApprovals = direction.execution?.ownerApprovals || [];
  return (
    <details className="uih-direction-details">
      <summary>
        <span>Direction & strategy</span>
        <small>Why · gate · evidence · history</small>
      </summary>

      <div className="uih-direction-body">
        <div className="uih-direction-section uih-direction-strategy">
          <div className="uih-direction-section-head">
            <span>Strategy</span>
            <small>Maintained by {direction.steward}</small>
          </div>
          <div className="uih-direction-grid">
            <div><strong>Problem</strong><p>{direction.strategy.problem}</p></div>
            <div><strong>Customer</strong><p>{direction.strategy.customer}</p></div>
            <div><strong>Why now</strong><p>{direction.strategy.whyNow}</p></div>
            <div><strong>North Star</strong><p>{direction.strategy.northStar}</p></div>
            <div><strong>Business model</strong><p>{direction.strategy.businessModel}</p></div>
            <div><strong>Long-term destination</strong><p>{direction.strategy.longTermDestination}</p></div>
          </div>
        </div>

        <div className="uih-direction-section">
          <div className="uih-direction-section-head">
            <span>Current mission</span>
            <small>{direction.decision.phaseLabel}</small>
          </div>
          <div className="uih-mission-callout">
            <strong>Decision being earned</strong>
            <p>{direction.decision.decisionBeingEarned}</p>
          </div>
          <div className="uih-direction-grid">
            <div><strong>Current hypothesis</strong><p>{direction.decision.currentHypothesis}</p></div>
            <div><strong>Next gate</strong><p>{direction.decision.nextGate}</p></div>
            <div><strong>Success criteria</strong><TextList items={direction.decision.successCriteria} /></div>
            <div><strong>Kill criteria</strong><TextList items={direction.decision.killCriteria} /></div>
            <div><strong>Next actions</strong><TextList items={direction.execution.nextActions} /></div>
            <div><strong>Blockers</strong><TextList items={direction.execution.blockers} /></div>
            <div><strong>Dependencies</strong><TextList items={direction.execution.dependencies} /></div>
            <div><strong>Owner approvals</strong><TextList items={ownerApprovals} empty="No owner approval currently required." /></div>
          </div>
        </div>

        <div className="uih-direction-section">
          <div className="uih-direction-section-head">
            <span>Evidence</span>
            <div className="uih-direction-head-badges">
              <span className="uih-evidence-confidence">Confidence: {direction.evidence.confidence}</span>
              <span className={freshnessClass(direction.freshness.status)}>{direction.freshness.status}</span>
            </div>
          </div>
          {direction.evidence.confidenceNote && <p className="uih-confidence-note">{direction.evidence.confidenceNote}</p>}
          <div className="uih-evidence-columns">
            <div className="uih-evidence-proven"><strong>Proven / demonstrated</strong><TextList items={direction.evidence.proven} /></div>
            <div className="uih-evidence-unproven"><strong>Still unproven</strong><TextList items={direction.evidence.unproven} /></div>
          </div>
          {direction.evidence.latestResult && (
            <div className="uih-latest-result"><strong>Latest result</strong><span>{direction.evidence.latestResult}</span></div>
          )}
          {Array.isArray(direction.evidence.links) && direction.evidence.links.length > 0 && (
            <div className="uih-evidence-links">
              {direction.evidence.links.map((link) => (
                <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} ↗</a>
              ))}
            </div>
          )}
          <dl className="uih-freshness-meta">
            <div><dt>Strategy updated</dt><dd>{direction.freshness.lastStrategicUpdate || "—"}</dd></div>
            <div><dt>Last work activity</dt><dd>{direction.freshness.lastWorkActivity || "Not synced yet"}</dd></div>
            <div><dt>Last evidence</dt><dd>{direction.freshness.lastEvidenceAt || "—"}</dd></div>
          </dl>
        </div>

        <div className="uih-direction-section">
          <div className="uih-direction-section-head">
            <span>Decision history</span>
            <small>Institutional memory</small>
          </div>
          {direction.history?.length ? (
            <div className="uih-history-list">
              {direction.history.slice().reverse().map((entry, index) => (
                <div className="uih-history-item" key={`${entry.date}-${index}`}>
                  <div className="uih-history-date">{entry.date}</div>
                  <strong>{entry.decision}</strong>
                  <p>{entry.reason}</p>
                  <dl>
                    <div><dt>Previous</dt><dd>{entry.previousState || "—"}</dd></div>
                    <div><dt>New</dt><dd>{entry.newState || "—"}</dd></div>
                    <div><dt>Authorized by</dt><dd>{entry.authorizedBy || "—"}</dd></div>
                  </dl>
                </div>
              ))}
            </div>
          ) : <p className="uih-empty-copy">No strategic decisions recorded yet.</p>}
        </div>

        <div className="uih-direction-sourcebar">
          <span><strong>Strategy:</strong> {direction.sources?.strategy || "Project Direction Registry"}</span>
          <span><strong>Execution:</strong> {direction.sources?.execution || "Work Control"}</span>
          <span><strong>Evidence:</strong> {direction.sources?.evidence || "Specialist teams + QA"}</span>
        </div>
      </div>
    </details>
  );
}

function ProjectCard({ project, pinned, onPin, onOpen }) {
  const inferred = project.urlConfidence === "INFERRED";
  const direction = DIRECTION_BY_UI.get(project.id);
  const needsOwner = direction?.freshness?.status === "NEEDS_OWNER" || (direction?.execution?.ownerApprovals || []).length > 0;

  return (
    <article className={`uih-card ${project.health === "ATTENTION" ? "uih-card-attention" : ""} ${direction ? "uih-card-direction" : ""}`}>
      <div className="uih-card-top">
        <div className="uih-card-title-wrap">
          <div className="uih-family">{project.family}</div>
          <h3>{project.name}</h3>
        </div>
        <button
          className={`uih-pin ${pinned ? "is-pinned" : ""}`}
          onClick={() => onPin(project.id)}
          title={pinned ? "Unpin UI" : "Pin UI"}
          aria-label={pinned ? `Unpin ${project.name}` : `Pin ${project.name}`}
        >
          {pinned ? "★" : "☆"}
        </button>
      </div>

      <p className="uih-description">{project.description}</p>

      <div className="uih-badges">
        <span className={lifecycleClass(project.lifecycle)}>{project.lifecycle}</span>
        <span className={healthClass(project.health)}>{project.health}</span>
        <span className="uih-pill uih-platform">{project.platform}</span>
        {direction && <span className="uih-pill uih-direction-badge">DIRECTION ✓</span>}
      </div>

      {direction ? (
        <div className="uih-direction-summary">
          <div className="uih-direction-phase-row">
            <span className="uih-direction-phase">{direction.decision.phaseLabel}</span>
            <div className="uih-direction-statuses">
              <span className="uih-confidence-chip">{direction.evidence.confidence}</span>
              <span className={freshnessClass(direction.freshness.status)}>{direction.freshness.status}</span>
            </div>
          </div>
          <div className="uih-decision-earning">
            <span>Decision being earned</span>
            <strong>{direction.decision.decisionBeingEarned}</strong>
          </div>
          <div className="uih-direction-compact-grid">
            <div><span>Next gate</span><strong>{direction.decision.nextGate}</strong></div>
            <div><span>North Star</span><strong>{direction.strategy.northStar}</strong></div>
          </div>
          <StageRail phase={direction.decision.phase} />
          <div className="uih-direction-kpis">
            <span><strong>{direction.execution.nextActions?.length || 0}</strong> next actions</span>
            <span><strong>{direction.execution.blockers?.length || 0}</strong> blockers</span>
            <span className={needsOwner ? "needs-owner" : ""}><strong>{direction.execution.ownerApprovals?.length || 0}</strong> needs owner</span>
          </div>
        </div>
      ) : (
        <div className="uih-direction-unmigrated">
          <strong>Project Direction not yet normalized</strong>
          <span>UI asset remains valid. Agent 000 / Project Steward owns progressive migration.</span>
        </div>
      )}

      <dl className="uih-meta">
        <div><dt>Owner</dt><dd>{project.owner || "Unassigned"}</dd></div>
        <div><dt>Deploy</dt><dd>{project.deploymentMode || "Unknown"}</dd></div>
        <div><dt>Repo</dt><dd>{project.repo || "Not mapped"}</dd></div>
        <div><dt>Project ID</dt><dd title={project.vercelProjectId}>{project.vercelProjectId || "—"}</dd></div>
      </dl>

      {project.notes && <div className={`uih-note ${project.health === "ATTENTION" ? "attention" : ""}`}>{project.notes}</div>}
      {inferred && <div className="uih-url-warning">Launch alias inferred from project name — verify once before treating as canonical.</div>}

      {direction && <DirectionDetails direction={direction} />}

      <div className="uih-actions">
        <a
          className="uih-button uih-button-primary"
          href={project.launchUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onOpen(project.id)}
        >
          {inferred ? "Try UI ↗" : "Open UI ↗"}
        </a>
        <a className="uih-button" href={manageUrl(project)} target="_blank" rel="noopener noreferrer">Vercel</a>
        {project.repo && <a className="uih-button" href={repoUrl(project.repo)} target="_blank" rel="noopener noreferrer">GitHub</a>}
      </div>
    </article>
  );
}

export default function UIHub() {
  const defaultPins = useMemo(() => registry.projects.filter((project) => project.pinned).map((project) => project.id), []);
  const [pins, setPins] = useState(() => readStored(PIN_KEY, defaultPins));
  const [recent, setRecent] = useState(() => readStored(RECENT_KEY, []));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [family, setFamily] = useState("ALL");

  const projects = registry.projects;
  const families = useMemo(() => [...new Set(projects.map((project) => project.family))].sort(), [projects]);
  const activeCount = projects.filter((project) => project.lifecycle === "ACTIVE").length;
  const attentionCount = projects.filter((project) => project.health === "ATTENTION").length;
  const archivedCount = projects.filter((project) => project.lifecycle === "ARCHIVE").length;
  const verifiedCount = projects.filter((project) => project.urlConfidence !== "INFERRED").length;
  const directionCount = directionRegistry.projects?.length || 0;
  const directionBacklog = projects.filter((project) => project.lifecycle === "ACTIVE" && !DIRECTION_BY_UI.has(project.id)).length;
  const staleCount = (directionRegistry.projects || []).filter((direction) => direction.freshness?.status === "STALE").length;
  const needsOwnerCount = (directionRegistry.projects || []).filter((direction) => direction.freshness?.status === "NEEDS_OWNER" || (direction.execution?.ownerApprovals || []).length > 0).length;

  const togglePin = (id) => {
    setPins((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [id, ...current];
      window.localStorage.setItem(PIN_KEY, JSON.stringify(next));
      return next;
    });
  };

  const recordOpen = (id) => {
    setRecent((current) => {
      const next = [id, ...current.filter((item) => item !== id)].slice(0, 8);
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  };

  const pinnedProjects = pins
    .map((id) => projects.find((project) => project.id === id))
    .filter(Boolean);

  const recentProjects = recent
    .map((id) => projects.find((project) => project.id === id))
    .filter(Boolean);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return projects
      .filter((project) => {
        const direction = DIRECTION_BY_UI.get(project.id);
        if (filter === "PINNED" && !pins.includes(project.id)) return false;
        if (filter === "ATTENTION" && project.health !== "ATTENTION") return false;
        if (filter === "DIRECTION" && !direction) return false;
        if (filter === "NEEDS_OWNER" && !(direction?.freshness?.status === "NEEDS_OWNER" || (direction?.execution?.ownerApprovals || []).length > 0)) return false;
        if (["ACTIVE", "PROTOTYPE", "ARCHIVE"].includes(filter) && project.lifecycle !== filter) return false;
        if (family !== "ALL" && project.family !== family) return false;
        if (!needle) return true;
        return [
          project.name,
          project.vercelProjectName,
          project.family,
          project.description,
          project.owner,
          project.repo,
          ...(project.tags || []),
          direction ? JSON.stringify(direction) : "",
        ].filter(Boolean).join(" ").toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        const aPinned = pins.includes(a.id) ? 1 : 0;
        const bPinned = pins.includes(b.id) ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        const aDirection = DIRECTION_BY_UI.has(a.id) ? 1 : 0;
        const bDirection = DIRECTION_BY_UI.has(b.id) ? 1 : 0;
        if (aDirection !== bDirection) return bDirection - aDirection;
        const lifeOrder = { ACTIVE: 0, PROTOTYPE: 1, ARCHIVE: 2 };
        const aLife = lifeOrder[a.lifecycle] ?? 9;
        const bLife = lifeOrder[b.lifecycle] ?? 9;
        if (aLife !== bLife) return aLife - bLife;
        return a.name.localeCompare(b.name);
      });
  }, [projects, query, filter, family, pins]);

  return (
    <div className="uih-page">
      <header className="uih-header">
        <div>
          <div className="uih-eyebrow">FACTORY CONTROL · PORTFOLIO OPERATING SYSTEM</div>
          <h1>UI Hub</h1>
          <p>Interfaces, strategy, current decisions, evidence and execution context in one permanent control surface.</p>
        </div>
        <div className="uih-header-actions">
          <Link className="uih-button" to="/factory-control">← Work Control</Link>
          <a className="uih-button" href={`https://vercel.com/${registry.team.teamSlug}`} target="_blank" rel="noopener noreferrer">Vercel Projects ↗</a>
        </div>
      </header>

      <section className="uih-stats" aria-label="UI registry summary">
        <div><strong>{projects.length}</strong><span>Registered UIs</span></div>
        <div><strong>{activeCount}</strong><span>Active</span></div>
        <div><strong>{directionCount}</strong><span>Direction normalized</span></div>
        <div><strong>{needsOwnerCount}</strong><span>Need owner</span></div>
        <div><strong>{attentionCount}</strong><span>Needs attention</span></div>
        <div><strong>{verifiedCount}</strong><span>Verified launch paths</span></div>
      </section>

      <section className="uih-governance">
        <div className="uih-governance-mark">✓</div>
        <div>
          <strong>Hub cards are now views of canonical project state — not standalone notes.</strong>
          <span>UI Registry owns interface identity and launch paths. Project Direction owns strategy, gates and evidence. Work Control remains the execution source; Agent 000 / Project Steward maintains strategic coherence.</span>
        </div>
      </section>

      {pinnedProjects.length > 0 && (
        <section className="uih-section">
          <div className="uih-section-head">
            <div><h2>Pinned UIs</h2><p>Your high-value launchpad. Strategic projects show their current decision and next gate directly on the card.</p></div>
          </div>
          <div className="uih-card-grid uih-pinned-grid">
            {pinnedProjects.map((project) => <ProjectCard key={project.id} project={project} pinned onPin={togglePin} onOpen={recordOpen} />)}
          </div>
        </section>
      )}

      {recentProjects.length > 0 && (
        <section className="uih-section uih-recent-section">
          <div className="uih-section-head"><div><h2>Recently opened</h2><p>Fast return path to interfaces you are actively using.</p></div></div>
          <div className="uih-recent-list">
            {recentProjects.map((project) => (
              <a key={project.id} href={project.launchUrl} target="_blank" rel="noopener noreferrer" onClick={() => recordOpen(project.id)}>
                <span>{project.name}</span><small>{project.family}</small>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="uih-section">
        <div className="uih-section-head">
          <div><h2>All registered UIs</h2><p>Search by project, purpose, owner, repo, tag, North Star, gate or strategic hypothesis.</p></div>
          <span className="uih-result-count">{visible.length} shown</span>
        </div>

        <div className="uih-toolbar">
          <div className="uih-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search interfaces and project direction…" /></div>
          <select value={family} onChange={(event) => setFamily(event.target.value)} aria-label="Filter by project family">
            <option value="ALL">All project families</option>
            {families.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>

        <div className="uih-filters">
          {[
            ["ALL", "All"],
            ["PINNED", "Pinned"],
            ["DIRECTION", `Direction (${directionCount})`],
            ["NEEDS_OWNER", `Needs owner (${needsOwnerCount})`],
            ["ACTIVE", "Active"],
            ["PROTOTYPE", "Prototype"],
            ["ATTENTION", `Needs attention (${attentionCount})`],
            ["ARCHIVE", "Archive / probes"],
          ].map(([value, label]) => (
            <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>

        {visible.length ? (
          <div className="uih-card-grid">
            {visible.map((project) => (
              <ProjectCard key={project.id} project={project} pinned={pins.includes(project.id)} onPin={togglePin} onOpen={recordOpen} />
            ))}
          </div>
        ) : (
          <div className="uih-empty">No interfaces match the current search and filters.</div>
        )}
      </section>

      <section className="uih-section uih-attention-section">
        <div className="uih-section-head"><div><h2>Registry & stewardship maintenance</h2><p>Agent 000 / Project Steward owns strategic coherence; UI and deployment maintenance remain with their existing Factory owners.</p></div></div>
        <div className="uih-maintenance-grid">
          <div><strong>{directionBacklog}</strong><span>active projects awaiting direction migration</span></div>
          <div><strong>{staleCount}</strong><span>normalized projects marked stale</span></div>
          <div><strong>{projects.filter((project) => project.urlConfidence === "INFERRED").length}</strong><span>launch aliases need one-time verification</span></div>
          <div><strong>{projects.filter((project) => !project.repo).length}</strong><span>repos not yet mapped</span></div>
        </div>
      </section>

      <footer className="uih-footer">
        UI assets: <code>agent-factory/governance/ui-registry-v1.json</code> · Project strategy: <code>agent-factory/governance/project-direction-registry-v1.json</code> · Direction updated {directionRegistry.updatedAt} · UI registry updated {registry.updatedAt}
      </footer>
    </div>
  );
}
