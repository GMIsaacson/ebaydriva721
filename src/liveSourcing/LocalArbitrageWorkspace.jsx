import React, { useEffect, useMemo, useState } from "react";
import { buildLocalArbitrageQueue } from "./local-arbitrage-core.mjs";
import { LIVE_SHADOW_CANDIDATES } from "./local-arbitrage-shadow-data.mjs";
import { useAuth } from "../AuthProvider";
import "./local-arbitrage.css";

const money = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format((cents || 0) / 100);
const decisionLabel = (value) => String(value || "").replaceAll("_", " ");
const econValue = (item, value, format = money) => item.economicsReady ? format(value) : "Pending";

function CandidateDrawer({ item, raw, onClose, ownerState, onOwnerState }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!item || !raw) return null;
  const econ = item.economics;
  const resaleChannels = raw.resaleChannels || [];
  const preferredChannel = resaleChannels.find((channel) => channel.recommended) || resaleChannels[0] || null;
  const costRows = [
    ["Selling fees", raw.sellingFeesCents], ["Shipping", raw.shippingCents], ["Pickup", raw.pickupCents],
    ["Packaging", raw.packagingCents], ["Refurbishment", raw.refurbishmentCents], ["Risk reserve", raw.riskReserveCents],
  ];

  return (
    <div className="la-drawer-layer" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="la-drawer" role="dialog" aria-modal="true" aria-label={`${item.title} details`}>
        <div className="la-drawer-head">
          <div>
            <p className="la-eyebrow">OWNER REVIEW · {item.id}</p>
            <h2>{item.title}</h2>
            <p>{item.source} · {item.location || "Location unavailable"}</p>
          </div>
          <button className="la-icon-button" onClick={onClose} aria-label="Close details">×</button>
        </div>

        <div className="la-drawer-scoreline">
          <span className={`la-pill ${item.decision.toLowerCase()}`}>{decisionLabel(item.decision)}</span>
          <strong>Score {item.dealScore}/100</strong>
          <span>{item.sourceListingVerified ? "Exact source captured" : "Source unresolved"}</span>
          <span>{item.economicsReady ? `${item.soldCompCount} sold comps` : "Economics pending"}</span>
        </div>

        <section className="la-drawer-section">
          <div className="la-section-heading">
            <h3>Exact source listing</h3>
            {item.sourceListingVerified && raw.listingUrl
              ? <a className="la-source-button" href={raw.listingUrl} target="_blank" rel="noreferrer">Open exact listing ↗</a>
              : <span>Exact permalink unavailable</span>}
          </div>
          <div className="la-source-record">
            <div><small>Marketplace</small><strong>{raw.source}</strong></div>
            <div><small>Listing ID</small><strong>{raw.sourceListingId || "—"}</strong></div>
            <div><small>Observed ask</small><strong>{money(econ.askPriceCents)}</strong></div>
            <div><small>Evidence age</small><strong>{item.evidenceAgeHours ?? "—"}h</strong></div>
          </div>
          {item.sourceListingVerified && raw.listingUrl
            ? <a className="la-permalink" href={raw.listingUrl} target="_blank" rel="noreferrer">{raw.listingUrl}</a>
            : <p className="la-callout warning">This record cannot become BUY_CANDIDATE until an exact source URL or preserved listing snapshot is attached.</p>}
          <p className="la-detail-note">{raw.conditionNote || "No condition note recorded."}</p>
        </section>

        <section className="la-drawer-section">
          <div className="la-section-heading"><h3>Where to sell</h3><span>{preferredChannel ? `Preferred: ${preferredChannel.channel}` : "Pending comp verification"}</span></div>
          <div className="la-exit-list">
            {resaleChannels.length ? resaleChannels.map((channel, idx) => (
              <article className={channel.recommended ? "recommended" : ""} key={`${channel.channel}-${idx}`}>
                <div className="la-exit-head"><div><strong>{channel.channel}</strong><small>{channel.mode}</small></div>{channel.recommended && <span>Recommended</span>}</div>
                <div className="la-exit-price"><small>Expected sell</small><b>{channel.expectedPriceCents ? money(channel.expectedPriceCents) : "Hold"}</b></div>
                <p>{channel.reason}</p>
              </article>
            )) : <p className="la-callout warning">Exit channel is intentionally unresolved until exact item identity and comparable sales are verified.</p>}
          </div>
        </section>

        <section className="la-drawer-section">
          <div className="la-section-heading"><h3>Image / item evidence</h3><span>{item.exactIdentity ? "Identity gate satisfied" : "Verification required"}</span></div>
          <div className="la-chip-list">{(raw.visibleItems || ["No itemization recorded"]).map((label) => <span key={label}>{label}</span>)}</div>
          {!item.exactIdentity && <p className="la-callout warning">Model/SKU identity is still unresolved. Do not promote this record to BUY.</p>}
        </section>

        <section className="la-drawer-section">
          <div className="la-section-heading"><h3>Comp evidence</h3><span>{item.soldCompCount ? `${item.soldCompCount} verified sold comps` : "Not yet comped"}</span></div>
          <div className="la-comp-list">
            {(raw.compEvidence || []).length ? (raw.compEvidence || []).map((comp, idx) => (
              <div className="la-comp-row" key={`${comp.source}-${idx}`}><div><strong>{comp.label}</strong><small>{comp.source} · {comp.status}</small></div><b>{money(comp.priceCents)}</b></div>
            )) : <p className="la-callout warning">No verified sold comps attached yet.</p>}
          </div>
        </section>

        <section className="la-drawer-section">
          <div className="la-section-heading"><h3>Landed economics</h3><span>Thresholds: $50 net · 40% ROI</span></div>
          <div className="la-econ-summary">
            <div><small>Expected net</small><strong>{econValue(item, econ.expectedNetProfitCents)}</strong></div>
            <div><small>ROI</small><strong>{item.economicsReady ? `${econ.roiPct}%` : "Pending"}</strong></div>
            <div><small>Max buy</small><strong>{econValue(item, econ.maxBuyPriceCents)}</strong></div>
          </div>
          {item.economicsReady
            ? <div className="la-cost-list">{costRows.map(([label, cents]) => <div key={label}><span>{label}</span><b>{money(cents)}</b></div>)}<div className="total"><span>Non-acquisition costs</span><b>{money(econ.nonAcquisitionCostsCents)}</b></div></div>
            : <p className="la-callout">Economics remain pending until comp evidence and identity verification are complete.</p>}
        </section>

        <section className="la-drawer-section">
          <div className="la-section-heading"><h3>Decision rationale</h3><span>Fail-closed evidence</span></div>
          <ul className="la-reason-list">{item.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </section>

        <section className="la-drawer-section la-owner-review">
          <div className="la-section-heading"><h3>Owner disposition</h3><span>No external action</span></div>
          <div className="la-owner-actions">
            <button className={ownerState === "reviewed" ? "active" : ""} onClick={() => onOwnerState("reviewed")}>Mark reviewed</button>
            <button className={ownerState === "watch" ? "active" : ""} onClick={() => onOwnerState("watch")}>Keep watch</button>
            <button className={ownerState === "reject" ? "active danger" : ""} onClick={() => onOwnerState("reject")}>Owner reject</button>
          </div>
          <p className="la-callout">These controls only annotate this preview session. They do not message a seller, place an offer, or purchase anything.</p>
        </section>
      </aside>
    </div>
  );
}

export default function LocalArbitrageWorkspace() {
  const { currentUser } = useAuth();
  const [listings, setListings] = useState(LIVE_SHADOW_CANDIDATES);
  const [selectedId, setSelectedId] = useState(null);
  const [ownerStates, setOwnerStates] = useState({});
  const [imageTitle, setImageTitle] = useState("Local marketplace bundle");
  const [imageUrl, setImageUrl] = useState("");
  const [imageData, setImageData] = useState("");
  const [itemization, setItemization] = useState(null);
  const [itemizeStatus, setItemizeStatus] = useState("");

  const result = useMemo(() => buildLocalArbitrageQueue(listings), [listings]);
  const selectedItem = result.ranked.find((item) => item.id === selectedId) || null;
  const selectedRaw = listings.find((item) => item.id === selectedId) || null;

  const addManualListing = () => setListings((items) => [...items, {
    id: `MANUAL-${Date.now()}`,
    title: "New manual candidate",
    source: "Manual intake",
    location: "Twin Cities, MN",
    askPriceCents: 0,
    expectedSaleCents: 0,
    economicsReady: false,
    exactIdentity: false,
    soldCompCount: 0,
    evidenceObservedAt: new Date().toISOString(),
    listingUrl: "",
    sourceListingUrlVerified: false,
    conditionNote: "Awaiting exact source URL, identity and comp verification.",
    visibleItems: ["Unresolved listing"],
    compEvidence: [],
    resaleChannels: [],
  }]);

  const loadFile = (file) => {
    if (!file) return;
    if (!file.type?.startsWith("image/")) return setItemizeStatus("Choose an image file.");
    if (file.size > 5_000_000) return setItemizeStatus("Image must be 5 MB or smaller.");
    const reader = new FileReader();
    reader.onload = () => { setImageData(String(reader.result || "")); setImageUrl(""); setItemizeStatus("Image loaded. Ready to itemize."); };
    reader.onerror = () => setItemizeStatus("Could not read image.");
    reader.readAsDataURL(file);
  };

  const itemizeImage = async () => {
    const image = imageData || imageUrl.trim();
    if (!image) return setItemizeStatus("Add an image URL or upload an image first.");
    if (!currentUser) return setItemizeStatus("Log in to run bounded image itemization.");
    setItemization(null);
    setItemizeStatus("Analyzing visible items…");
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/local-arbitrage-itemize", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: imageTitle, images: [image], approvedMaxCostUsd: 0.02 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || payload?.status || `Request failed (${response.status})`);
      setItemization(payload.itemization || null);
      setItemizeStatus(`Itemized with ${payload.itemization?.imageConfidence || 0}% image confidence · $${Number(payload.conservativeBatchCeilingUsd || 0).toFixed(2)} approved ceiling.`);
    } catch (error) {
      setItemizeStatus(error?.message || "Itemization failed.");
    }
  };

  return (
    <main className="ds-page la-page">
      <header className="la-hero">
        <div><p className="la-eyebrow">RUN 004 · LOCAL ARBITRAGE · G5 SHADOW</p><h1>Twin Cities deal intelligence</h1><p>Every live shadow record must point back to the exact source listing. BUY means owner review only—never an automatic purchase.</p></div>
        <div className="la-safety"><strong>Research-only authority</strong><span>0 seller messages</span><span>0 purchases</span><span>0 restricted scraping</span></div>
      </header>

      <section className="ds-kpi-grid la-kpis">
        <div className="ds-kpi"><div className="ds-kpi-label">Screened</div><div className="ds-kpi-value">{result.screenedCount}</div></div>
        <div className="ds-kpi"><div className="ds-kpi-label">Buy candidates</div><div className="ds-kpi-value">{result.actionableCount}</div></div>
        <div className="ds-kpi"><div className="ds-kpi-label">Verified density</div><div className="ds-kpi-value">{result.densityPct}%</div></div>
        <div className="ds-kpi"><div className="ds-kpi-label">Lane verdict</div><div className="ds-kpi-value la-verdict">{result.laneVerdict === "CONTINUE_TESTING" ? "Continue" : "Redesign"}</div></div>
      </section>

      <section className="ds-panel la-control">
        <div><h2 className="ds-section-title">Pilot rules</h2><p className="ds-section-copy">Exact source permalink/snapshot · exact identity · verified sold comps · ≥ $50 expected net · ≥ 40% ROI.</p></div>
        <button className="ds-button ds-button-secondary" type="button" onClick={addManualListing}>Add manual candidate</button>
      </section>

      <section className="ds-panel la-itemizer">
        <div><p className="la-eyebrow">IMAGE EVIDENCE · BOUNDED VISION</p><h2 className="ds-section-title">Itemize an information-poor listing</h2><p className="ds-section-copy">Use a public image URL or upload a screenshot/photo. Vision identifies visible components only.</p></div>
        <div className="la-itemizer-grid">
          <label><span className="ds-label">Listing title</span><input value={imageTitle} onChange={(e) => setImageTitle(e.target.value)} /></label>
          <label><span className="ds-label">Public image URL</span><input placeholder="https://…/listing-image.jpg" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); if (e.target.value) setImageData(""); }} /></label>
          <label><span className="ds-label">Or upload image</span><input type="file" accept="image/*" onChange={(e) => loadFile(e.target.files?.[0])} /></label>
          <div className="la-itemizer-action"><button className="ds-button ds-button-primary" type="button" onClick={itemizeImage}>Itemize visible tools</button><small>{itemizeStatus || "Per-image conservative approval ceiling: $0.02"}</small></div>
        </div>
        {itemization && <div className="la-itemization-result"><p><strong>{itemization.summary || "Visible-item analysis"}</strong></p><div className="la-item-cards">{(itemization.items || []).map((item, index) => <article key={`${item.label}-${index}`}><strong>{item.quantity > 1 ? `${item.quantity}× ` : ""}{item.label}</strong><span>{[item.brand, item.modelOrMpn].filter(Boolean).join(" · ") || "Model not legible"}</span><small>{item.identityConfidence}% identity confidence · {item.requiresManualVerification ? "manual verification required" : "visible identity sufficient for comp lookup"}</small><small>{item.visibleEvidence}</small></article>)}</div></div>}
      </section>

      <section className="ds-panel la-table-wrap">
        <div className="la-table-intro"><div><h2 className="ds-section-title">Live shadow queue</h2><p className="ds-section-copy">Candidate titles with a ↗ are exact source permalinks. Click elsewhere on the row for the evidence drawer.</p></div><span>Traceable source records</span></div>
        <table className="la-table">
          <thead><tr><th>Candidate</th><th>Source</th><th>Ask</th><th>Expected sale</th><th>Net</th><th>ROI</th><th>Max buy</th><th>Score</th><th>Decision</th></tr></thead>
          <tbody>{result.ranked.map((item) => {
            const raw = listings.find((candidate) => candidate.id === item.id) || {};
            return <tr key={item.id} className="la-clickable-row" onClick={() => setSelectedId(item.id)} tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedId(item.id)}>
              <td>
                {item.sourceListingVerified && raw.listingUrl
                  ? <a className="la-candidate-link" href={raw.listingUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{item.title} ↗</a>
                  : <strong>{item.title}</strong>}
                <small>{item.location || "—"} · ID {raw.sourceListingId || "unresolved"}</small>
              </td>
              <td><span className={item.sourceListingVerified ? "la-live-badge" : "la-pending-badge"}>{item.sourceListingVerified ? "LIVE" : "PENDING"}</span>{item.source}</td>
              <td>{money(item.economics.askPriceCents)}</td>
              <td>{econValue(item, item.economics.expectedSaleCents)}</td>
              <td>{econValue(item, item.economics.expectedNetProfitCents)}</td>
              <td>{item.economicsReady ? `${item.economics.roiPct}%` : "Pending"}</td>
              <td>{econValue(item, item.economics.maxBuyPriceCents)}</td>
              <td>{item.dealScore}</td>
              <td><span className={`la-pill ${item.decision.toLowerCase()}`}>{decisionLabel(item.decision)}</span><small>{item.reasons[0]}</small></td>
            </tr>;
          })}</tbody>
        </table>
      </section>

      <section className="ds-panel la-flow"><h2 className="ds-section-title">Decision pipeline</h2><div className="la-flow-row"><span>Exact source permalink</span><b>→</b><span>Image itemization</span><b>→</b><span>Comp evidence</span><b>→</b><span>Landed economics</span><b>→</b><span>Exit channel</span><b>→</b><span>Owner review</span></div></section>

      <CandidateDrawer item={selectedItem} raw={selectedRaw} onClose={() => setSelectedId(null)} ownerState={ownerStates[selectedId]} onOwnerState={(state) => setOwnerStates((prev) => ({ ...prev, [selectedId]: state }))} />
    </main>
  );
}
