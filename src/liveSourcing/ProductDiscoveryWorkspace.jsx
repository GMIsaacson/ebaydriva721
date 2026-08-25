import React, { useState } from "react";
import { useAuth } from "../AuthProvider";
import "./sourcing-workspace.css";

const DISCOVERY_COST_USD = 0.05;

const money = (cents) => {
  if (!Number.isFinite(cents)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
};

const statusClass = (status) => status === "PASS" ? "high" : status === "FAIL" ? "low" : "medium";

const ProductDiscoveryWorkspace = () => {
  const { currentUser } = useAuth();
  const [focus, setFocus] = useState("household, kitchen, automotive, cleaning, workshop, pet accessories, simple tools");
  const [maxResults, setMaxResults] = useState("10");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const runDiscovery = async () => {
    setError("");
    setResult(null);
    setRunning(true);
    try {
      if (!currentUser) throw new Error("Sign in before running Product Opportunity Discovery.");
      const count = Number(maxResults);
      if (!Number.isSafeInteger(count) || count < 1 || count > 10) throw new Error("Result count must be an integer from 1 to 10.");
      const token = await currentUser.getIdToken();
      const response = await fetch("/api/product-opportunity-discovery", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          maxResults: count,
          focus: focus.trim(),
          approvedMaxCostUsd: DISCOVERY_COST_USD,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || payload.status || `Discovery failed (${response.status}).`);
      setResult(payload);
    } catch (runError) {
      console.error("Product Opportunity Discovery failed:", runError);
      setError(runError.message || "Product discovery could not be completed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="ds-page ds-sourcing-page">
      <header className="ds-sourcing-hero">
        <div>
          <p className="ds-sourcing-eyebrow">RUN 004 · PRODUCT OPPORTUNITY DISCOVERY · G5 SHADOW</p>
          <h1>Discover eBay sourcing opportunities independently</h1>
          <p>Run a bounded public-web research pass that looks for demonstrated eBay sold demand and low-cost Alibaba supply. Candidates remain research leads until exact BOM, shipping and full landed economics are verified.</p>
        </div>
        <div className="ds-sourcing-safety">
          <strong>Read-only shadow</strong>
          <span>0 purchases or bids</span>
          <span>0 seller messages or listings</span>
          <span>Maximum approved search budget: ${DISCOVERY_COST_USD.toFixed(2)}</span>
        </div>
      </header>

      <section className="ds-panel ds-sourcing-intake">
        <div className="ds-sourcing-section-head">
          <div>
            <h2 className="ds-section-title">Independent discovery run</h2>
            <p className="ds-section-copy">The scout prefers generic products with 100+ sold, useful ASP, small/light form factors, low compliance/IP risk, and supplier cost around 20% of retail or less.</p>
          </div>
          <span className="ds-sourcing-badge">GREEN · bounded web search</span>
        </div>

        <div className="ds-sourcing-form-grid">
          <label>
            <span className="ds-label">Search focus</span>
            <input value={focus} onChange={(event) => setFocus(event.target.value)} placeholder="Categories or product themes" />
            <small>Leave broad for general discovery or narrow it to a category.</small>
          </label>
          <label>
            <span className="ds-label">Maximum results</span>
            <input type="number" min="1" max="10" step="1" value={maxResults} onChange={(event) => setMaxResults(event.target.value)} />
            <small>Hard capped at 10 candidates per run.</small>
          </label>
        </div>

        <div className="ds-sourcing-alert ds-sourcing-alert-supplier">
          <strong>Evidence discipline.</strong> Independent sold counts are labeled WEB_OBSERVED. A discovery PASS is not a BUY. Exact product matching, 3–10 supplier comparisons and full landed-cost stress testing remain the next gate.
        </div>
        {error && <div className="ds-sourcing-alert ds-sourcing-alert-error">{error}</div>}
        <div className="ds-sourcing-actions">
          <button className="ds-button ds-button-primary" type="button" disabled={running} onClick={runDiscovery}>
            {running ? "Discovering…" : `Discover up to ${maxResults || 10} products · approve $${DISCOVERY_COST_USD.toFixed(2)} max`}
          </button>
          {result && <button className="ds-button ds-button-secondary" type="button" onClick={() => setResult(null)}>Clear</button>}
        </div>
      </section>

      {result && (
        <>
          <section className="ds-kpi-grid ds-sourcing-kpis" aria-label="Product discovery summary">
            <div className="ds-kpi"><span className="ds-kpi-label">Candidates</span><div className="ds-kpi-value">{result.candidates?.length || 0}</div></div>
            <div className="ds-kpi"><span className="ds-kpi-label">Stage-1 PASS</span><div className="ds-kpi-value">{result.stage1PassCount || 0}</div></div>
            <div className="ds-kpi"><span className="ds-kpi-label">External actions</span><div className="ds-kpi-value">{result.externalActions || 0}</div></div>
            <div className="ds-kpi"><span className="ds-kpi-label">Search ceiling</span><div className="ds-kpi-value">${Number(result.conservativeRunCeilingUsd || 0).toFixed(2)}</div></div>
          </section>

          <section className="ds-panel ds-sourcing-queue">
            <div className="ds-sourcing-section-head">
              <div>
                <h2 className="ds-section-title">Discovered opportunities</h2>
                <p className="ds-section-copy">Rank these as research leads only. Source price is public supplier evidence, not landed/DDP cost.</p>
              </div>
              <span className="ds-sourcing-badge ds-sourcing-badge-yellow">YELLOW · stress test next</span>
            </div>

            {!result.candidates?.length ? (
              <div className="ds-empty">No candidate met the evidence requirements in this bounded run. The scout returned empty rather than inventing evidence.</div>
            ) : (
              <div className="ds-sourcing-table-wrap">
                <table className="ds-sourcing-table">
                  <thead>
                    <tr><th>Candidate</th><th>eBay sold</th><th>eBay price</th><th>Supplier</th><th>Source cost</th><th>MOQ</th><th>Source ratio</th><th>Stage 1</th><th>Evidence</th></tr>
                  </thead>
                  <tbody>
                    {result.candidates.map((candidate, index) => (
                      <tr key={`${candidate.productTitle}-${index}`}>
                        <td><strong>{candidate.productTitle}</strong><small>{candidate.productSummary}</small></td>
                        <td><strong>{candidate.ebay.soldCount.toLocaleString()}</strong><small>{candidate.provenance}</small></td>
                        <td><strong>{money(candidate.ebay.itemPriceCents)}</strong><small>{candidate.ebay.shippingMode}{candidate.ebay.shippingChargeCents ? ` · ${money(candidate.ebay.shippingChargeCents)} shipping` : ""}</small></td>
                        <td><strong>{candidate.supplier.name}</strong><small>{candidate.exactnessNotes}</small></td>
                        <td><strong>{money(candidate.supplier.unitCostCents)}</strong><small>public quote · not landed</small></td>
                        <td>{candidate.supplier.moq}</td>
                        <td>{(candidate.preliminarySourceRatioBps / 100).toFixed(1)}%</td>
                        <td><span className={`ds-sourcing-confidence ${statusClass(candidate.stage1)}`}>{candidate.stage1}</span><small>{candidate.confidence} confidence</small></td>
                        <td><a href={candidate.ebay.url} target="_blank" rel="noopener noreferrer">eBay ↗</a><small><a href={candidate.supplier.url} target="_blank" rel="noopener noreferrer">Alibaba ↗</a></small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="ds-panel ds-sourcing-summary">
            <p><strong>Next gate:</strong> {result.nextGate}. Nothing on this page authorizes a purchase or listing.</p>
          </section>
        </>
      )}
    </main>
  );
};

export default ProductDiscoveryWorkspace;
