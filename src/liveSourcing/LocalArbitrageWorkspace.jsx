import React, { useMemo, useState } from "react";
import { buildLocalArbitrageQueue } from "./local-arbitrage-core.mjs";
import { useAuth } from "../AuthProvider";
import "./local-arbitrage.css";

const now = new Date().toISOString();
const DEMO = [
  { id: "TC-001", title: "Mixed power-tool bundle", source: "OfferUp", location: "Plymouth, MN", askPriceCents: 9500, expectedSaleCents: 21000, sellingFeesCents: 2800, shippingCents: 0, pickupCents: 1200, packagingCents: 500, refurbishmentCents: 800, riskReserveCents: 1500, exactIdentity: true, soldCompCount: 5, evidenceObservedAt: now },
  { id: "TC-002", title: "Miter saw + stand", source: "Craigslist", location: "St. Paul, MN", askPriceCents: 5000, expectedSaleCents: 14500, sellingFeesCents: 1700, shippingCents: 0, pickupCents: 900, packagingCents: 0, refurbishmentCents: 600, riskReserveCents: 1200, exactIdentity: true, soldCompCount: 4, evidenceObservedAt: now },
  { id: "TC-003", title: "Milwaukee M18 Top-Off", source: "OfferUp", location: "Minneapolis, MN", askPriceCents: 7500, expectedSaleCents: 6900, sellingFeesCents: 900, shippingCents: 900, pickupCents: 700, packagingCents: 250, refurbishmentCents: 0, riskReserveCents: 500, exactIdentity: true, soldCompCount: 3, evidenceObservedAt: now },
  { id: "TC-004", title: "Garage cleanout tool lot", source: "Facebook Marketplace", location: "Brooklyn Park, MN", askPriceCents: 8000, expectedSaleCents: 22000, sellingFeesCents: 3000, shippingCents: 0, pickupCents: 1100, packagingCents: 500, refurbishmentCents: 1000, riskReserveCents: 1800, exactIdentity: false, soldCompCount: 2, unresolvedItems: 3, ambiguousCondition: true, evidenceObservedAt: now },
];

const money = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format((cents || 0) / 100);

export default function LocalArbitrageWorkspace() {
  const { currentUser } = useAuth();
  const [listings, setListings] = useState(DEMO);
  const [imageTitle, setImageTitle] = useState("Local marketplace bundle");
  const [imageUrl, setImageUrl] = useState("");
  const [imageData, setImageData] = useState("");
  const [itemization, setItemization] = useState(null);
  const [itemizeStatus, setItemizeStatus] = useState("");
  const result = useMemo(() => buildLocalArbitrageQueue(listings), [listings]);

  const addDemoListing = () => setListings((items) => [...items, {
    id: `TC-${String(items.length + 1).padStart(3, "0")}`,
    title: "New local listing",
    source: "Manual intake",
    location: "Twin Cities, MN",
    askPriceCents: 6000,
    expectedSaleCents: 14000,
    sellingFeesCents: 1800,
    pickupCents: 900,
    packagingCents: 300,
    refurbishmentCents: 500,
    riskReserveCents: 1200,
    exactIdentity: false,
    soldCompCount: 0,
    evidenceObservedAt: new Date().toISOString(),
  }]);

  const loadFile = (file) => {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setItemizeStatus("Choose an image file.");
      return;
    }
    if (file.size > 5_000_000) {
      setItemizeStatus("Image must be 5 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageData(String(reader.result || ""));
      setImageUrl("");
      setItemizeStatus("Image loaded. Ready to itemize.");
    };
    reader.onerror = () => setItemizeStatus("Could not read image.");
    reader.readAsDataURL(file);
  };

  const itemizeImage = async () => {
    const image = imageData || imageUrl.trim();
    if (!image) {
      setItemizeStatus("Add an image URL or upload an image first.");
      return;
    }
    if (!currentUser) {
      setItemizeStatus("Log in to run bounded image itemization.");
      return;
    }
    setItemization(null);
    setItemizeStatus("Analyzing visible items…");
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/local-arbitrage-itemize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: imageTitle,
          images: [image],
          approvedMaxCostUsd: 0.02,
        }),
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
        <div>
          <p className="la-eyebrow">RUN 004 · LOCAL ARBITRAGE · G5 SHADOW</p>
          <h1>Twin Cities deal intelligence</h1>
          <p>Rank messy local listings by verified resale economics. BUY means candidate for owner review only—never an automatic purchase.</p>
        </div>
        <div className="la-safety"><strong>Research-only authority</strong><span>0 seller messages</span><span>0 purchases</span><span>0 restricted scraping</span></div>
      </header>

      <section className="ds-kpi-grid la-kpis">
        <div className="ds-kpi"><div className="ds-kpi-label">Screened</div><div className="ds-kpi-value">{result.screenedCount}</div></div>
        <div className="ds-kpi"><div className="ds-kpi-label">Buy candidates</div><div className="ds-kpi-value">{result.actionableCount}</div></div>
        <div className="ds-kpi"><div className="ds-kpi-label">Verified density</div><div className="ds-kpi-value">{result.densityPct}%</div></div>
        <div className="ds-kpi"><div className="ds-kpi-label">Lane verdict</div><div className="ds-kpi-value la-verdict">{result.laneVerdict === "CONTINUE_TESTING" ? "Continue" : "Redesign"}</div></div>
      </section>

      <section className="ds-panel la-control">
        <div><h2 className="ds-section-title">Pilot rules</h2><p className="ds-section-copy">Twin Cities · power tools · ≥ $50 expected net profit · ≥ 40% ROI · exact identity + sold comp required for BUY_CANDIDATE.</p></div>
        <button className="ds-button ds-button-secondary" type="button" onClick={addDemoListing}>Add manual candidate</button>
      </section>

      <section className="ds-panel la-itemizer">
        <div>
          <p className="la-eyebrow">IMAGE EVIDENCE · BOUNDED VISION</p>
          <h2 className="ds-section-title">Itemize an information-poor listing</h2>
          <p className="ds-section-copy">Use a public image URL or upload a screenshot/photo. Vision only identifies visible components; it does not price them, assume function, contact sellers, or purchase anything.</p>
        </div>
        <div className="la-itemizer-grid">
          <label><span className="ds-label">Listing title</span><input value={imageTitle} onChange={(e) => setImageTitle(e.target.value)} /></label>
          <label><span className="ds-label">Public image URL</span><input placeholder="https://…/listing-image.jpg" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); if (e.target.value) setImageData(""); }} /></label>
          <label><span className="ds-label">Or upload image</span><input type="file" accept="image/*" onChange={(e) => loadFile(e.target.files?.[0])} /></label>
          <div className="la-itemizer-action"><button className="ds-button ds-button-primary" type="button" onClick={itemizeImage}>Itemize visible tools</button><small>{itemizeStatus || "Per-image conservative approval ceiling: $0.02"}</small></div>
        </div>
        {itemization && (
          <div className="la-itemization-result">
            <p><strong>{itemization.summary || "Visible-item analysis"}</strong></p>
            <div className="la-item-cards">
              {(itemization.items || []).map((item, index) => (
                <article key={`${item.label}-${index}`}>
                  <strong>{item.quantity > 1 ? `${item.quantity}× ` : ""}{item.label}</strong>
                  <span>{[item.brand, item.modelOrMpn].filter(Boolean).join(" · ") || "Model not legible"}</span>
                  <small>{item.identityConfidence}% identity confidence · {item.requiresManualVerification ? "manual verification required" : "visible identity sufficient for comp lookup"}</small>
                  <small>{item.visibleEvidence}</small>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="ds-panel la-table-wrap">
        <table className="la-table">
          <thead><tr><th>Candidate</th><th>Source</th><th>Ask</th><th>Expected sale</th><th>Net</th><th>ROI</th><th>Max buy</th><th>Score</th><th>Decision</th></tr></thead>
          <tbody>
            {result.ranked.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.title}</strong><small>{item.location || "—"}</small></td>
                <td>{item.source}</td><td>{money(item.economics.askPriceCents)}</td><td>{money(item.economics.expectedSaleCents)}</td><td>{money(item.economics.expectedNetProfitCents)}</td><td>{item.economics.roiPct}%</td><td>{money(item.economics.maxBuyPriceCents)}</td><td>{item.dealScore}</td>
                <td><span className={`la-pill ${item.decision.toLowerCase()}`}>{item.decision.replace("_", " ")}</span><small>{item.reasons[0]}</small></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="ds-panel la-flow">
        <h2 className="ds-section-title">Decision pipeline</h2>
        <div className="la-flow-row"><span>Local listing</span><b>→</b><span>Image itemization</span><b>→</b><span>Comp evidence</span><b>→</b><span>Landed economics</span><b>→</b><span>Deal score</span><b>→</b><span>Owner review</span></div>
      </section>
    </main>
  );
}
