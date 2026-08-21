import React, { useMemo, useState } from "react";
import { buildLocalArbitrageQueue } from "./local-arbitrage-core.mjs";
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
  const [listings, setListings] = useState(DEMO);
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

  return (
    <main className="ds-page la-page">
      <header className="la-hero">
        <div>
          <p className="la-eyebrow">RUN 004 · LOCAL ARBITRAGE · G4 PREVIEW</p>
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
        <div className="la-flow-row"><span>Local listing</span><b>→</b><span>Item decomposition</span><b>→</b><span>Comp evidence</span><b>→</b><span>Landed economics</span><b>→</b><span>Deal score</span><b>→</b><span>Owner review</span></div>
      </section>
    </main>
  );
}
