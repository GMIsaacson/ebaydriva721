import React, { useEffect, useMemo, useState } from "react";
import { buildLocalArbitrageQueue } from "./local-arbitrage-core.mjs";
import { useAuth } from "../AuthProvider";
import "./local-arbitrage.css";

const now = new Date().toISOString();
const DEMO = [
  {
    id: "TC-001", title: "Mixed power-tool bundle", source: "OfferUp", location: "Plymouth, MN", askPriceCents: 9500,
    expectedSaleCents: 21000, sellingFeesCents: 2800, shippingCents: 0, pickupCents: 1200, packagingCents: 500,
    refurbishmentCents: 800, riskReserveCents: 1500, exactIdentity: true, soldCompCount: 5, evidenceObservedAt: now,
    listingUrl: "https://offerup.com/", listingUrlVerified: false,
    conditionNote: "Used mixed bundle; function of each component must be confirmed at pickup.",
    visibleItems: ["4 power drills", "Scroll saw", "Blow torch", "Reaming tool"],
    compEvidence: [
      { source: "eBay sold", label: "Comparable drill lots", priceCents: 7200, status: "supporting" },
      { source: "eBay sold", label: "Scroll saw comps", priceCents: 6200, status: "supporting" },
      { source: "Public web", label: "Accessory breakup value", priceCents: 7600, status: "supporting" },
    ],
    resaleChannels: [
      { channel: "eBay", expectedPriceCents: 21000, recommended: true, mode: "Part out", reason: "Best price discovery when identifiable components are sold separately; shipping effort is higher." },
      { channel: "Facebook Marketplace", expectedPriceCents: 17500, recommended: false, mode: "Local pickup", reason: "Lower friction and no parcel shipping, but mixed lots usually trade at a discount." },
      { channel: "OfferUp", expectedPriceCents: 16500, recommended: false, mode: "Local pickup", reason: "Useful secondary local channel if the lot does not move quickly." },
    ],
  },
  {
    id: "TC-002", title: "Miter saw + stand", source: "Craigslist", location: "St. Paul, MN", askPriceCents: 5000,
    expectedSaleCents: 14500, sellingFeesCents: 1700, shippingCents: 0, pickupCents: 900, packagingCents: 0,
    refurbishmentCents: 600, riskReserveCents: 1200, exactIdentity: true, soldCompCount: 4, evidenceObservedAt: now,
    listingUrl: "https://minneapolis.craigslist.org/", listingUrlVerified: false,
    conditionNote: "Used saw with stand; blade, fence, motor and stand locking points require inspection.",
    visibleItems: ["Miter saw", "Portable stand"],
    compEvidence: [
      { source: "eBay sold", label: "Same-class used miter saw", priceCents: 9800, status: "exact-enough" },
      { source: "Local resale", label: "Used portable saw stand", priceCents: 4700, status: "supporting" },
    ],
    resaleChannels: [
      { channel: "Facebook Marketplace", expectedPriceCents: 14500, recommended: true, mode: "Local pickup", reason: "Bulky saw + stand is expensive and awkward to ship; local pickup protects margin." },
      { channel: "Craigslist", expectedPriceCents: 13500, recommended: false, mode: "Local pickup", reason: "Good fit for contractor/tool buyers, but usually a smaller buyer pool." },
      { channel: "OfferUp", expectedPriceCents: 14000, recommended: false, mode: "Local pickup", reason: "Useful cross-listing channel for local tool demand." },
    ],
  },
  {
    id: "TC-003", title: "Milwaukee M18 Top-Off", source: "OfferUp", location: "Minneapolis, MN", askPriceCents: 7500,
    expectedSaleCents: 6900, sellingFeesCents: 900, shippingCents: 900, pickupCents: 700, packagingCents: 250,
    refurbishmentCents: 0, riskReserveCents: 500, exactIdentity: true, soldCompCount: 3, evidenceObservedAt: now,
    listingUrl: "https://offerup.com/", listingUrlVerified: false,
    conditionNote: "Identity is clear; economics fail even before additional risk allowance.",
    visibleItems: ["Milwaukee M18 Top-Off"],
    compEvidence: [
      { source: "eBay", label: "Current used/new offers", priceCents: 6000, status: "exact" },
      { source: "Retail", label: "Current new market reference", priceCents: 6900, status: "exact" },
    ],
    resaleChannels: [
      { channel: "eBay", expectedPriceCents: 6900, recommended: true, mode: "Ship", reason: "Standardized SKU has a broad national buyer pool, but this acquisition price still fails economics." },
      { channel: "Facebook Marketplace", expectedPriceCents: 6000, recommended: false, mode: "Local pickup", reason: "Avoids shipping, but expected local price is lower." },
    ],
  },
  {
    id: "TC-004", title: "Garage cleanout tool lot", source: "Facebook Marketplace", location: "Brooklyn Park, MN", askPriceCents: 8000,
    expectedSaleCents: 22000, sellingFeesCents: 3000, shippingCents: 0, pickupCents: 1100, packagingCents: 500,
    refurbishmentCents: 1000, riskReserveCents: 1800, exactIdentity: false, soldCompCount: 2, unresolvedItems: 3,
    ambiguousCondition: true, evidenceObservedAt: now, listingUrl: "", listingUrlVerified: false,
    conditionNote: "Information-poor bundle. Current value is provisional until image itemization resolves the unidentified tools.",
    visibleItems: ["Cordless drill", "Circular saw", "Battery/charger", "3 unresolved items"],
    compEvidence: [
      { source: "eBay sold", label: "Partial bundle components", priceCents: 12800, status: "partial" },
      { source: "Local resale", label: "Comparable mixed garage lots", priceCents: 9200, status: "partial" },
    ],
    resaleChannels: [
      { channel: "Undetermined", expectedPriceCents: 0, recommended: true, mode: "Hold", reason: "Do not choose an exit channel until image itemization resolves the unidentified components." },
    ],
  },
];

const money = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format((cents || 0) / 100);
const decisionLabel = (value) => String(value || "").replaceAll("_", " ");

function CandidateDrawer({ item, raw, onClose, ownerState, onOwnerState }) {
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!item || !raw) return null;
  const econ = item.economics;
  const costRows = [
    ["Selling fees", raw.sellingFeesCents], ["Shipping", raw.shippingCents], ["Pickup", raw.pickupCents],
    ["Packaging", raw.packagingCents], ["Refurbishment", raw.refurbishmentCents], ["Risk reserve", raw.riskReserveCents],
  ];
  const resaleChannels = raw.resaleChannels || [];
  const preferredChannel = resaleChannels.find((channel) => channel.recommended) || resaleChannels[0] || null;

  return (
    <div className="la-drawer-layer" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="la-drawer" role="dialog" aria-modal="true" aria-label={`${item.title} details`}>
        <div className="la-drawer-head">
          <div><p className="la-eyebrow">OWNER REVIEW · {item.id}</p><h2>{item.title}</h2><p>{item.source} · {item.location || "Location unavailable"}</p></div>
          <button className="la-icon-button" onClick={onClose} aria-label="Close details">×</button>
        </div>

        <div className="la-drawer-scoreline">
          <span className={`la-pill ${item.decision.toLowerCase()}`}>{decisionLabel(item.decision)}</span>
          <strong>Score {item.dealScore}/100</strong>
          <span>{item.exactIdentity ? "Exact identity" : "Identity unresolved"}</span>
          <span>{item.soldCompCount} sold comp{item.soldCompCount === 1 ? "" : "s"}</span>
        </div>

        <section className="la-drawer-section">
          <div className="la-section-heading">
            <h3>Listing evidence</h3>
            {raw.listingUrl && raw.listingUrlVerified
              ? <a className="la-source-button" href={raw.listingUrl} target="_blank" rel="noreferrer">View live listing ↗</a>
              : raw.listingUrl
                ? <a href={raw.listingUrl} target="_blank" rel="noreferrer">Marketplace source ↗</a>
                : <span>Exact listing link unavailable</span>}
          </div>
          <div className="la-detail-grid">
            <div><small>Ask</small><strong>{money(econ.askPriceCents)}</strong></div>
            <div><small>Expected sale</small><strong>{money(econ.expectedSaleCents)}</strong></div>
            <div><small>Evidence age</small><strong>{item.evidenceAgeHours ?? "—"}h</strong></div>
            <div><small>Authority</small><strong>Research only</strong></div>
          </div>
          {!raw.listingUrlVerified && <p className="la-callout warning">The exact live-sale URL has not been attached to this record yet. The system will only show “View live listing” after that exact URL is captured.</p>}
          <p className="la-detail-note">{raw.conditionNote || "No condition note recorded."}</p>
        </section>

        <section className="la-drawer-section">
          <div className="la-section-heading"><h3>Where to sell</h3><span>{preferredChannel ? `Preferred: ${preferredChannel.channel}` : "Exit channel unresolved"}</span></div>
          <div className="la-exit-list">
            {resaleChannels.length ? resaleChannels.map((channel, idx) => (
              <article className={channel.recommended ? "recommended" : ""} key={`${channel.channel}-${idx}`}>
                <div className="la-exit-head"><div><strong>{channel.channel}</strong><small>{channel.mode}</small></div>{channel.recommended && <span>Recommended</span>}</div>
                <div className="la-exit-price"><small>Expected sell</small><b>{channel.expectedPriceCents ? money(channel.expectedPriceCents) : "Hold"}</b></div>
                <p>{channel.reason}</p>
              </article>
            )) : <p className="la-callout warning">No verified resale-channel recommendation is attached yet.</p>}
          </div>
          <p className="la-callout">Channel recommendations are decision support only. They do not create a listing or publish inventory.</p>
        </section>

        <section className="la-drawer-section">
          <div className="la-section-heading"><h3>Image itemization</h3><span>{item.exactIdentity ? "Identity gate satisfied" : "Verification required"}</span></div>
          <div className="la-chip-list">{(raw.visibleItems || ["No itemization recorded"]).map((label) => <span key={label}>{label}</span>)}</div>
          {!item.exactIdentity && <p className="la-callout warning">Do not promote to BUY until model/SKU identity and condition are verified for the unresolved components.</p>}
        </section>

        <section className="la-drawer-section">
          <div className="la-section-heading"><h3>Comp evidence</h3><span>{item.soldCompCount} verified sold comps in score</span></div>
          <div className="la-comp-list">
            {(raw.compEvidence || []).map((comp, idx) => (
              <div className="la-comp-row" key={`${comp.source}-${idx}`}><div><strong>{comp.label}</strong><small>{comp.source} · {comp.status}</small></div><b>{money(comp.priceCents)}</b></div>
            ))}
          </div>
        </section>

        <section className="la-drawer-section">
          <div className="la-section-heading"><h3>Landed economics</h3><span>Thresholds: $50 net · 40% ROI</span></div>
          <div className="la-econ-summary">
            <div><small>Expected net</small><strong>{money(econ.expectedNetProfitCents)}</strong></div>
            <div><small>ROI</small><strong>{econ.roiPct}%</strong></div>
            <div><small>Max buy</small><strong>{money(econ.maxBuyPriceCents)}</strong></div>
          </div>
          <div className="la-cost-list">{costRows.map(([label, cents]) => <div key={label}><span>{label}</span><b>{money(cents)}</b></div>)}<div className="total"><span>Non-acquisition costs</span><b>{money(econ.nonAcquisitionCostsCents)}</b></div></div>
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
  const [listings, setListings] = useState(DEMO);
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

  const addDemoListing = () => setListings((items) => [...items, {
    id: `TC-${String(items.length + 1).padStart(3, "0")}`, title: "New local listing", source: "Manual intake", location: "Twin Cities, MN",
    askPriceCents: 6000, expectedSaleCents: 14000, sellingFeesCents: 1800, pickupCents: 900, packagingCents: 300,
    refurbishmentCents: 500, riskReserveCents: 1200, exactIdentity: false, soldCompCount: 0, evidenceObservedAt: new Date().toISOString(),
    conditionNote: "Awaiting identity and evidence verification.", visibleItems: ["Unresolved listing"], compEvidence: [], resaleChannels: [], listingUrl: "", listingUrlVerified: false,
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
    setItemization(null); setItemizeStatus("Analyzing visible items…");
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/local-arbitrage-itemize", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: imageTitle, images: [image], approvedMaxCostUsd: 0.02 }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || payload?.status || `Request failed (${response.status})`);
      setItemization(payload.itemization || null);
      setItemizeStatus(`Itemized with ${payload.itemization?.imageConfidence || 0}% image confidence · $${Number(payload.conservativeBatchCeilingUsd || 0).toFixed(2)} approved ceiling.`);
    } catch (error) { setItemizeStatus(error?.message || "Itemization failed."); }
  };

  return (
    <main className="ds-page la-page">
      <header className="la-hero"><div><p className="la-eyebrow">RUN 004 · LOCAL ARBITRAGE · G5 SHADOW</p><h1>Twin Cities deal intelligence</h1><p>Rank messy local listings by verified resale economics. BUY means candidate for owner review only—never an automatic purchase.</p></div><div className="la-safety"><strong>Research-only authority</strong><span>0 seller messages</span><span>0 purchases</span><span>0 restricted scraping</span></div></header>

      <section className="ds-kpi-grid la-kpis"><div className="ds-kpi"><div className="ds-kpi-label">Screened</div><div className="ds-kpi-value">{result.screenedCount}</div></div><div className="ds-kpi"><div className="ds-kpi-label">Buy candidates</div><div className="ds-kpi-value">{result.actionableCount}</div></div><div className="ds-kpi"><div className="ds-kpi-label">Verified density</div><div className="ds-kpi-value">{result.densityPct}%</div></div><div className="ds-kpi"><div className="ds-kpi-label">Lane verdict</div><div className="ds-kpi-value la-verdict">{result.laneVerdict === "CONTINUE_TESTING" ? "Continue" : "Redesign"}</div></div></section>

      <section className="ds-panel la-control"><div><h2 className="ds-section-title">Pilot rules</h2><p className="ds-section-copy">Twin Cities · power tools · ≥ $50 expected net profit · ≥ 40% ROI · exact identity + sold comp required for BUY_CANDIDATE.</p></div><button className="ds-button ds-button-secondary" type="button" onClick={addDemoListing}>Add manual candidate</button></section>

      <section className="ds-panel la-itemizer"><div><p className="la-eyebrow">IMAGE EVIDENCE · BOUNDED VISION</p><h2 className="ds-section-title">Itemize an information-poor listing</h2><p className="ds-section-copy">Use a public image URL or upload a screenshot/photo. Vision only identifies visible components; it does not price them, assume function, contact sellers, or purchase anything.</p></div><div className="la-itemizer-grid"><label><span className="ds-label">Listing title</span><input value={imageTitle} onChange={(e) => setImageTitle(e.target.value)} /></label><label><span className="ds-label">Public image URL</span><input placeholder="https://…/listing-image.jpg" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); if (e.target.value) setImageData(""); }} /></label><label><span className="ds-label">Or upload image</span><input type="file" accept="image/*" onChange={(e) => loadFile(e.target.files?.[0])} /></label><div className="la-itemizer-action"><button className="ds-button ds-button-primary" type="button" onClick={itemizeImage}>Itemize visible tools</button><small>{itemizeStatus || "Per-image conservative approval ceiling: $0.02"}</small></div></div>{itemization && <div className="la-itemization-result"><p><strong>{itemization.summary || "Visible-item analysis"}</strong></p><div className="la-item-cards">{(itemization.items || []).map((item, index) => <article key={`${item.label}-${index}`}><strong>{item.quantity > 1 ? `${item.quantity}× ` : ""}{item.label}</strong><span>{[item.brand, item.modelOrMpn].filter(Boolean).join(" · ") || "Model not legible"}</span><small>{item.identityConfidence}% identity confidence · {item.requiresManualVerification ? "manual verification required" : "visible identity sufficient for comp lookup"}</small><small>{item.visibleEvidence}</small></article>)}</div></div>}
      </section>

      <section className="ds-panel la-table-wrap">
        <div className="la-table-intro"><div><h2 className="ds-section-title">Deal queue</h2><p className="ds-section-copy">Click any row to inspect the source, exit channel, evidence and economics behind the decision.</p></div><span>Owner review workstation</span></div>
        <table className="la-table"><thead><tr><th>Candidate</th><th>Source</th><th>Ask</th><th>Expected sale</th><th>Net</th><th>ROI</th><th>Max buy</th><th>Score</th><th>Decision</th></tr></thead><tbody>{result.ranked.map((item) => <tr key={item.id} className="la-clickable-row" onClick={() => setSelectedId(item.id)} tabIndex={0} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedId(item.id)}><td><strong>{item.title}</strong><small>{item.location || "—"}</small></td><td>{item.source}</td><td>{money(item.economics.askPriceCents)}</td><td>{money(item.economics.expectedSaleCents)}</td><td>{money(item.economics.expectedNetProfitCents)}</td><td>{item.economics.roiPct}%</td><td>{money(item.economics.maxBuyPriceCents)}</td><td>{item.dealScore}</td><td><span className={`la-pill ${item.decision.toLowerCase()}`}>{decisionLabel(item.decision)}</span><small>{item.reasons[0]}</small></td></tr>)}</tbody></table>
      </section>

      <section className="ds-panel la-flow"><h2 className="ds-section-title">Decision pipeline</h2><div className="la-flow-row"><span>Local listing</span><b>→</b><span>Image itemization</span><b>→</b><span>Comp evidence</span><b>→</b><span>Landed economics</span><b>→</b><span>Exit channel</span><b>→</b><span>Owner review</span></div></section>

      <CandidateDrawer item={selectedItem} raw={selectedRaw} onClose={() => setSelectedId(null)} ownerState={ownerStates[selectedId]} onOwnerState={(state) => setOwnerStates((prev) => ({ ...prev, [selectedId]: state }))} />
    </main>
  );
}
