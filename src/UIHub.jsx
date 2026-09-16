import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import registry from "../agent-factory/governance/ui-registry-v1.json";
import "./ui-hub.css";

const PIN_KEY = "factory-ui-hub-pins-v1";
const RECENT_KEY = "factory-ui-hub-recent-v1";

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

function manageUrl(project) {
  return `https://vercel.com/${registry.team.teamSlug}/${project.vercelProjectName}`;
}

function repoUrl(repo) {
  return repo ? `https://github.com/${repo}` : null;
}

function ProjectCard({ project, pinned, onPin, onOpen }) {
  const inferred = project.urlConfidence === "INFERRED";
  return (
    <article className={`uih-card ${project.health === "ATTENTION" ? "uih-card-attention" : ""}`}>
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
      </div>

      <dl className="uih-meta">
        <div><dt>Owner</dt><dd>{project.owner || "Unassigned"}</dd></div>
        <div><dt>Deploy</dt><dd>{project.deploymentMode || "Unknown"}</dd></div>
        <div><dt>Repo</dt><dd>{project.repo || "Not mapped"}</dd></div>
        <div><dt>Project ID</dt><dd title={project.vercelProjectId}>{project.vercelProjectId || "—"}</dd></div>
      </dl>

      {project.notes && <div className={`uih-note ${project.health === "ATTENTION" ? "attention" : ""}`}>{project.notes}</div>}
      {inferred && <div className="uih-url-warning">Launch alias inferred from project name — verify once before treating as canonical.</div>}

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
        if (filter === "PINNED" && !pins.includes(project.id)) return false;
        if (filter === "ATTENTION" && project.health !== "ATTENTION") return false;
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
        ].filter(Boolean).join(" ").toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        const aPinned = pins.includes(a.id) ? 1 : 0;
        const bPinned = pins.includes(b.id) ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
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
          <div className="uih-eyebrow">FACTORY CONTROL · ASSET REGISTRY</div>
          <h1>UI Hub</h1>
          <p>One permanent front door for every interface the Factory builds.</p>
        </div>
        <div className="uih-header-actions">
          <Link className="uih-button" to="/factory-control">← Work Control</Link>
          <a className="uih-button" href={`https://vercel.com/${registry.team.teamSlug}`} target="_blank" rel="noopener noreferrer">Vercel Projects ↗</a>
        </div>
      </header>

      <section className="uih-stats" aria-label="UI registry summary">
        <div><strong>{projects.length}</strong><span>Registered UIs</span></div>
        <div><strong>{activeCount}</strong><span>Active</span></div>
        <div><strong>{pinnedProjects.length}</strong><span>Pinned</span></div>
        <div><strong>{attentionCount}</strong><span>Needs attention</span></div>
        <div><strong>{archivedCount}</strong><span>Archive / probes</span></div>
        <div><strong>{verifiedCount}</strong><span>Verified launch paths</span></div>
      </section>

      <section className="uih-governance">
        <div className="uih-governance-mark">✓</div>
        <div>
          <strong>Registry rule is now part of Factory release governance.</strong>
          <span>New UIs are not considered complete until they have a registry record, launch path, owner and lifecycle state. Old UIs are archived, not forgotten.</span>
        </div>
      </section>

      {pinnedProjects.length > 0 && (
        <section className="uih-section">
          <div className="uih-section-head">
            <div><h2>Pinned UIs</h2><p>Your high-value launchpad. Pins are stored in this browser.</p></div>
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
          <div><h2>All registered UIs</h2><p>Search by project, purpose, owner, repo or tag.</p></div>
          <span className="uih-result-count">{visible.length} shown</span>
        </div>

        <div className="uih-toolbar">
          <div className="uih-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search all interfaces…" /></div>
          <select value={family} onChange={(event) => setFamily(event.target.value)} aria-label="Filter by project family">
            <option value="ALL">All project families</option>
            {families.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>

        <div className="uih-filters">
          {[
            ["ALL", "All"],
            ["PINNED", "Pinned"],
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
        <div className="uih-section-head"><div><h2>Registry maintenance</h2><p>Items marked attention are not deleted. They stay visible until consolidated, repaired or intentionally archived.</p></div></div>
        <div className="uih-maintenance-grid">
          <div><strong>{attentionCount}</strong><span>projects need review</span></div>
          <div><strong>{projects.filter((project) => project.urlConfidence === "INFERRED").length}</strong><span>launch aliases need one-time verification</span></div>
          <div><strong>{projects.filter((project) => !project.repo).length}</strong><span>repos not yet mapped</span></div>
        </div>
      </section>

      <footer className="uih-footer">
        Canonical registry: <code>agent-factory/governance/ui-registry-v1.json</code> · Updated {registry.updatedAt}
      </footer>
    </div>
  );
}
