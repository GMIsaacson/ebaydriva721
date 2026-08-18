import React, { useMemo, useState } from "react";
import { useAuth } from "../AuthProvider";
import { ingestBrowserDataset } from "./browser-core.mjs";
import { prescreenBrowserCandidates } from "./prescreen-v2.mjs";
import { assessBrowserPublicWebCompetitivePrice } from "./public-web-precheck.mjs";
import { buildBrowserProvisionalWebPool, finalizeBrowserWebGatedQueue } from "./web-gated-queue.mjs";
import { adaptSsActivewearDataset } from "./ss-activewear-adapter.mjs";
import CandidateVerificationPanel from "./CandidateVerificationPanel";
import "./sourcing-workspace.css";

const PUBLIC_WEB_PRECHECK_URL = "https://qxbstimgqkzqzzezwijw.supabase.co/functions/v1/datascout-public-web-precheck";
const PUBLIC_WEB_BATCH_LIMIT = 10;
const PUBLIC_WEB_COST_PER_SEARCH_USD = 0.005;
const PUBLIC_WEB_MIN_PROFIT_CENTS = 1500;
const PUBLIC_WEB_POOL_MULTIPLIER = 3;

const dollarsToCents = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${field} must be greater than $0.`);
  return Math.round(number * 100);
};

const money = (cents) => {
  if (!Number.isFinite(cents)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
};

const enrichSupplierEvidence = (records, adapted) => records.map((record) => {
  if (!adapted?.detected) {
    return { ...record, moqEvidence: "UNVERIFIED", moqEvidenceBasis: "generic upload did not provide a supplier-specific MOQ evidence contract" };
  }
  const metadata = adapted.metadataBySku?.[record.sourceSku];
  if (!metadata) {
    return { ...record, moqEvidence: "UNKNOWN", moqEvidenceBasis: "supplier metadata was not resolved for this SKU" };
  }
  return {
    ...record,
    moq: metadata.moq ?? record.moq,
    moqEvidence: metadata.moqEvidence,
    moqEvidenceBasis: metadata.moqEvidenceBasis,
    supplierSignals: {
      retailPriceCents: metadata.retailPriceCents,
      mapPriceCents: metadata.mapPriceCents,
      piecePriceCents: metadata.piecePriceCents,
      casePriceCents: metadata.casePriceCents,
      returnable: metadata.returnable,
      boxRequired: metadata.boxRequired,
      dropShipOnly: metadata.dropShipOnly,
      fullCaseOnly: metadata.fullCaseOnly,
      caseQty: metadata.caseQty,
      supplierRowNumber: metadata.supplierRowNumber,
    },
  };
});

const webStatusLabel = (assessment) => {
  if (!assessment) return "Pending";
  if (assessment.status === "GROSS_PROFIT_IMPOSSIBLE") return "DEFER WEB PRICE";
  if (assessment.status === "PRICE_RISK") return "PRICE RISK";
  if (assessment.status === "PLAUSIBLE") return "PLAUSIBLE";
  if (assessment.status === "NO_EVIDENCE") return "NO EXACT PRICE";
  return "REVIEW";
};

const SourcingWorkspace = () => {
  const { currentUser } = useAuth();
  const [file, setFile] = useState(null);
  const [defaultSupplier, setDefaultSupplier] = useState("");
  const [ownerAttestation, setOwnerAttestation] = useState(false);
  const [maxSourceCost, setMaxSourceCost] = useState("100");
  const [maxInitialOutlay, setMaxInitialOutlay] = useState("500");
  const [queueSize, setQueueSize] = useState("50");
  const [excludedTerms, setExcludedTerms] = useState("");
  const [webBudgetUsd, setWebBudgetUsd] = useState("0.05");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [intake, setIntake] = useState(null);
  const [prescreen, setPrescreen] = useState(null);
  const [supplierAdapter, setSupplierAdapter] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [publicWebRunning, setPublicWebRunning] = useState(false);
  const [publicWebError, setPublicWebError] = useState("");
  const [publicWebResults, setPublicWebResults] = useState({});
  const [publicWebMeta, setPublicWebMeta] = useState(null);

  const targetQueueSize = Number.isSafeInteger(Number(queueSize)) ? Number(queueSize) : 50;
  const provisionalPoolSize = Math.min(500, Math.max(targetQueueSize, targetQueueSize * PUBLIC_WEB_POOL_MULTIPLIER));

  const provisional = useMemo(() => prescreen
    ? buildBrowserProvisionalWebPool(prescreen, { poolSize: provisionalPoolSize })
    : null, [prescreen, provisionalPoolSize]);

  const webGate = useMemo(() => prescreen
    ? finalizeBrowserWebGatedQueue({
      prescreen,
      assessments: publicWebResults,
      maxVerificationQueue: targetQueueSize,
      poolSize: provisionalPoolSize,
    })
    : null, [prescreen, publicWebResults, targetQueueSize, provisionalPoolSize]);

  const queue = webGate?.verificationQueue || [];
  const pendingPool = provisional?.provisionalPool?.filter((item) => !publicWebResults[item.candidateId]) || [];
  const webDeferredCount = webGate?.webDeferredCount || 0;
  const webCheckedCount = webGate?.checkedCount || 0;

  const summary = useMemo(() => {
    if (!intake || !prescreen) return null;
    const supplierRestricted = supplierAdapter?.detected ? supplierAdapter.prohibitedCount : 0;
    const supplierReview = supplierAdapter?.detected ? supplierAdapter.reviewCount : 0;
    return {
      input: supplierAdapter?.detected ? supplierAdapter.inputCount : intake.inputCount,
      accepted: intake.acceptedCount,
      provisional: provisional?.provisionalPool?.length || 0,
      verify: webGate?.verificationCount || 0,
      webPending: webGate?.pendingWebCount || 0,
      webDeferred: webGate?.webDeferredCount || 0,
      review: supplierReview + intake.reviewCount + prescreen.reviewCount + intake.invalidCount + (webGate?.webReviewCount || 0),
      rejected: supplierRestricted + prescreen.rejectedCount,
      supplierRestricted,
    };
  }, [intake, prescreen, supplierAdapter, provisional, webGate]);

  const resetResults = () => {
    setIntake(null);
    setPrescreen(null);
    setSupplierAdapter(null);
    setSelectedCandidate(null);
    setPublicWebResults({});
    setPublicWebMeta(null);
    setPublicWebError("");
    setError("");
  };

  const handleFile = (event) => {
    const next = event.target.files?.[0] || null;
    setFile(next);
    resetResults();
  };

  const buildQueue = async () => {
    setError("");
    setSelectedCandidate(null);
    setPublicWebResults({});
    setPublicWebMeta(null);
    setPublicWebError("");
    if (!file) {
      setError("Choose an owner-authorized CSV or JSON product dataset first.");
      return;
    }
    if (!ownerAttestation) {
      setError("Confirm that you are authorized to use this dataset before DataScout processes it.");
      return;
    }

    setRunning(true);
    try {
      const maxVerificationQueue = Number(queueSize);
      if (!Number.isSafeInteger(maxVerificationQueue) || maxVerificationQueue < 1 || maxVerificationQueue > 100) throw new Error("Verification queue size must be an integer from 1 to 100.");
      const rawContent = await file.text();
      const adapted = adaptSsActivewearDataset({
        content: rawContent,
        fileName: file.name,
        defaultSupplier: defaultSupplier.trim() || "S&S Activewear",
      });
      const content = adapted.detected ? adapted.content : rawContent;
      const observedAt = new Date().toISOString();
      const nextIntake = await ingestBrowserDataset({
        ownerAttestation: true,
        uploadedBy: currentUser?.email || currentUser?.uid || "authenticated-owner",
        observedAt,
        fileName: adapted.detected ? `${file.name}.datascout.json` : file.name,
        format: adapted.detected ? "json" : undefined,
        content,
        defaultSupplier: adapted.detected ? adapted.supplier : (defaultSupplier.trim() || null),
      });
      const enrichedRecords = enrichSupplierEvidence(nextIntake.records, adapted);
      const nextPrescreen = prescreenBrowserCandidates(enrichedRecords, {
        maxVerificationQueue,
        maxSourceCostCents: dollarsToCents(maxSourceCost, "Maximum source cost"),
        maxInitialOutlayCents: dollarsToCents(maxInitialOutlay, "Maximum initial outlay"),
        excludedTerms: excludedTerms.split(",").map((term) => term.trim()).filter(Boolean),
      });
      setSupplierAdapter(adapted);
      setIntake(nextIntake);
      setPrescreen(nextPrescreen);
    } catch (runError) {
      console.error("Live sourcing prescreen failed:", runError);
      setError(runError.message || "The sourcing scan could not be completed.");
      setSupplierAdapter(null);
      setIntake(null);
      setPrescreen(null);
    } finally {
      setRunning(false);
    }
  };

  const runPublicWebPrecheck = async () => {
    setPublicWebError("");
    setPublicWebRunning(true);
    try {
      if (!currentUser) throw new Error("Sign in to DataScout before running paid public-web checks.");
      if (!pendingPool.length) throw new Error("The provisional public-web pool has no unchecked candidates.");
      const approvedBudget = Number(webBudgetUsd);
      if (!Number.isFinite(approvedBudget) || approvedBudget < PUBLIC_WEB_COST_PER_SEARCH_USD) throw new Error("Public-web budget must authorize at least one $0.005 search.");
      const maxSearches = Math.min(pendingPool.length, Math.floor((approvedBudget + 1e-9) / PUBLIC_WEB_COST_PER_SEARCH_USD));
      if (maxSearches < 1) throw new Error("The approved public-web budget does not cover one search.");

      const token = await currentUser.getIdToken();
      let totalEstimatedCostUsd = 0;
      let totalSearchRequests = 0;
      let provider = null;
      const accumulated = {};
      const candidatesToCheck = pendingPool.slice(0, maxSearches);

      for (let offset = 0; offset < candidatesToCheck.length; offset += PUBLIC_WEB_BATCH_LIMIT) {
        const batch = candidatesToCheck.slice(offset, offset + PUBLIC_WEB_BATCH_LIMIT);
        const batchBudget = Number((batch.length * PUBLIC_WEB_COST_PER_SEARCH_USD).toFixed(4));
        const response = await fetch(PUBLIC_WEB_PRECHECK_URL, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            approvedMaxCostUsd: batchBudget,
            candidates: batch.map((item) => ({
              candidateId: item.candidateId,
              title: item.record.title,
              brand: item.record.brand,
              mpn: item.record.mpn,
              upc: item.record.upc,
              packQuantity: item.record.packQuantity,
              unitCostCents: item.record.unitCostCents,
            })),
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || payload.status || `Public-web precheck failed (${response.status}).`);

        for (const check of payload.checks || []) {
          const provisionalEntry = provisional.provisionalPool.find((item) => item.candidateId === check.candidateId);
          if (!provisionalEntry) continue;
          accumulated[check.candidateId] = assessBrowserPublicWebCompetitivePrice({
            candidate: provisionalEntry.record,
            evidence: check.evidence || [],
            minProfitCents: PUBLIC_WEB_MIN_PROFIT_CENTS,
          });
        }
        totalEstimatedCostUsd += Number(payload.estimatedCostUsd || 0);
        totalSearchRequests += Number(payload.actualSearchRequests || 0);
        provider = payload.provider || provider;
      }

      setPublicWebResults((previous) => ({ ...previous, ...accumulated }));
      setPublicWebMeta({
        estimatedCostUsd: Number(((publicWebMeta?.estimatedCostUsd || 0) + totalEstimatedCostUsd).toFixed(4)),
        actualSearchRequests: (publicWebMeta?.actualSearchRequests || 0) + totalSearchRequests,
        provider,
      });
    } catch (runError) {
      console.error("Public-web competitive-price precheck failed:", runError);
      setPublicWebError(runError.message || "The public-web precheck could not be completed.");
    } finally {
      setPublicWebRunning(false);
    }
  };

  return (
    <main className="ds-page ds-sourcing-page">
      <header className="ds-sourcing-hero">
        <div>
          <p className="ds-sourcing-eyebrow">LIVE SOURCING MVP · OWNER-UPLOAD MODE</p>
          <h1>Find eBay opportunities without scraping suppliers or eBay</h1>
          <p>Load product data you are authorized to use. DataScout normalizes it, applies supplier restrictions and source-side constraints, creates a provisional research pool, applies the public-web competitive-price gate, and only then emits a bounded manual eBay verification queue.</p>
        </div>
        <div className="ds-sourcing-safety">
          <strong>Permission-safe mode</strong>
          <span>0 automated eBay fetches</span>
          <span>0 purchases or listings</span>
          <span>Public-web search only within approved budget</span>
        </div>
      </header>

      <section className="ds-panel ds-sourcing-intake">
        <div className="ds-sourcing-section-head">
          <div>
            <h2 className="ds-section-title">1. Authorized product universe</h2>
            <p className="ds-section-copy">CSV or JSON, up to 5,000 records in this MVP. Nothing is written to production Firestore.</p>
          </div>
          <span className="ds-sourcing-badge">GREEN · owner upload</span>
        </div>

        <div className="ds-sourcing-form-grid">
          <label className="ds-sourcing-file-field">
            <span className="ds-label">Product dataset</span>
            <input type="file" accept=".csv,.json,text/csv,application/json" onChange={handleFile} />
            <small>{file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB` : "Choose a CSV or JSON file"}</small>
          </label>
          <label><span className="ds-label">Default supplier</span><input value={defaultSupplier} onChange={(event) => setDefaultSupplier(event.target.value)} placeholder="Used only if supplier is absent in rows" /></label>
          <label><span className="ds-label">Max source cost / source unit</span><input type="number" min="0.01" step="0.01" value={maxSourceCost} onChange={(event) => setMaxSourceCost(event.target.value)} /></label>
          <label><span className="ds-label">Max minimum-order outlay</span><input type="number" min="0.01" step="0.01" value={maxInitialOutlay} onChange={(event) => setMaxInitialOutlay(event.target.value)} /></label>
          <label><span className="ds-label">Target eBay verification queue</span><input type="number" min="1" max="100" step="1" value={queueSize} onChange={(event) => setQueueSize(event.target.value)} /></label>
          <label><span className="ds-label">Excluded terms</span><input value={excludedTerms} onChange={(event) => setExcludedTerms(event.target.value)} placeholder="e.g. hazmat, lithium battery" /></label>
        </div>

        <label className="ds-sourcing-attestation"><input type="checkbox" checked={ownerAttestation} onChange={(event) => setOwnerAttestation(event.target.checked)} /><span>I confirm I am authorized to use and privately analyze this uploaded product data.</span></label>
        {error && <div className="ds-sourcing-alert ds-sourcing-alert-error">{error}</div>}
        <div className="ds-sourcing-actions">
          <button className="ds-button ds-button-primary" type="button" disabled={running} onClick={buildQueue}>{running ? "Analyzing…" : "Build provisional pool"}</button>
          {(intake || prescreen) && <button className="ds-button ds-button-secondary" type="button" onClick={resetResults}>Clear results</button>}
        </div>
      </section>

      {summary && (
        <>
          {supplierAdapter?.detected && (
            <section className="ds-sourcing-alert ds-sourcing-alert-supplier">
              <strong>S&S Activewear format detected.</strong> DataScout applied the supplier's `noeRetailing` restriction before prescreening: {supplierAdapter.prohibitedCount} prohibited row(s) blocked and {supplierAdapter.reviewCount} row(s) held because the restriction flag was missing or unclear.
            </section>
          )}

          <section className="ds-kpi-grid ds-sourcing-kpis" aria-label="Sourcing scan summary">
            <div className="ds-kpi"><span className="ds-kpi-label">Input rows</span><div className="ds-kpi-value">{summary.input}</div></div>
            <div className="ds-kpi"><span className="ds-kpi-label">Normalized</span><div className="ds-kpi-value">{summary.accepted}</div></div>
            <div className="ds-kpi"><span className="ds-kpi-label">Provisional web pool</span><div className="ds-kpi-value">{summary.provisional}</div></div>
            <div className="ds-kpi"><span className="ds-kpi-label">Final eBay queue</span><div className="ds-kpi-value">{summary.verify}</div></div>
          </section>

          <section className="ds-panel ds-sourcing-summary">
            <div className="ds-sourcing-summary-row">
              <div><strong>{summary.webPending}</strong><span>web checks pending</span></div>
              <div><strong>{summary.webDeferred}</strong><span>web-price defers</span></div>
              <div><strong>{summary.review}</strong><span>need review</span></div>
              <div><strong>{summary.rejected}</strong><span>source/restriction rejects</span></div>
            </div>
            <p><strong>Opportunity Score</strong> is supplier-side research priority only. No candidate can enter the final eBay queue until a public-web assessment exists. <strong>DEFER WEB PRICE</strong> is removed before eBay research; <strong>PRICE RISK</strong> survives but ranks behind stronger public-price outcomes.</p>
          </section>

          <section className="ds-panel ds-sourcing-summary">
            <div className="ds-sourcing-section-head">
              <div>
                <h2 className="ds-section-title">1.5 Public-web price gate</h2>
                <p className="ds-section-copy">Runs before final queue creation against a provisional pool up to 3× the target queue. It does not scrape eBay or retailer pages and cannot establish sold demand.</p>
              </div>
              <span className="ds-sourcing-badge">GREEN · search API</span>
            </div>
            <div className="ds-sourcing-form-grid">
              <label><span className="ds-label">Approved public-web budget for this run</span><input type="number" min="0.005" step="0.005" value={webBudgetUsd} onChange={(event) => setWebBudgetUsd(event.target.value)} /><small>$0.005 per search under the current provider contract; spend is explicit and bounded.</small></label>
            </div>
            <p><strong>{webCheckedCount}</strong> of <strong>{provisional?.provisionalPool?.length || 0}</strong> provisional candidates checked · <strong>{webDeferredCount}</strong> eliminated before eBay · <strong>{pendingPool.length}</strong> pending.</p>
            {publicWebError && <div className="ds-sourcing-alert ds-sourcing-alert-error">{publicWebError}</div>}
            {publicWebMeta && <p>Authorized search spend used so far: <strong>${Number(publicWebMeta.estimatedCostUsd || 0).toFixed(3)}</strong> · {publicWebMeta.actualSearchRequests || 0} search request(s) · {publicWebMeta.provider}</p>}
            <div className="ds-sourcing-actions">
              <button className="ds-button ds-button-primary" type="button" disabled={publicWebRunning || !pendingPool.length} onClick={runPublicWebPrecheck}>{publicWebRunning ? "Applying web gate…" : `Run web gate within $${Number(webBudgetUsd || 0).toFixed(3)} budget`}</button>
            </div>
          </section>

          <section className="ds-panel ds-sourcing-queue">
            <div className="ds-sourcing-section-head">
              <div>
                <h2 className="ds-section-title">2. Final eBay verification queue</h2>
                <p className="ds-section-copy">Created only from candidates that have already passed the public-web price gate. Exact eBay sold demand still requires manual Product Research.</p>
              </div>
              <span className="ds-sourcing-badge ds-sourcing-badge-yellow">YELLOW · manual verification</span>
            </div>

            {queue.length === 0 ? (
              <div className="ds-empty">No web-gated candidates are ready for eBay verification yet. Run the public-web gate; unchecked candidates never enter this queue.</div>
            ) : (
              <div className="ds-sourcing-table-wrap">
                <table className="ds-sourcing-table">
                  <thead><tr><th>Rank</th><th>Candidate</th><th>Supplier</th><th>Source cost</th><th>MOQ / outlay</th><th>Identity</th><th>Opportunity</th><th>Evidence</th><th>Supplier retail proxy</th><th>Web gate</th><th>Source</th><th>Next</th></tr></thead>
                  <tbody>
                    {queue.map((item) => {
                      const web = item.webAssessment;
                      return (
                        <tr key={item.candidateId} className={selectedCandidate?.candidateId === item.candidateId ? "selected" : ""}>
                          <td><strong>#{item.verificationRank}</strong></td>
                          <td><strong>{item.title}</strong><small>{item.candidateId}</small></td>
                          <td>{item.supplier}</td>
                          <td>{money(item.unitCostCents)}</td>
                          <td><strong>MOQ {item.moq}</strong><small>{money(item.initialOutlayCents)} · {item.record.moqEvidence || "UNVERIFIED"}</small></td>
                          <td><span className={`ds-sourcing-confidence ${item.record.identityConfidence.toLowerCase()}`}>{item.record.identityConfidence}</span><small>{item.identityBasis}</small></td>
                          <td><strong>{item.opportunityScore}/100</strong><small>{item.warnings?.length ? item.warnings.join(" · ") : "strong supplier-side research priority"}</small></td>
                          <td><strong>{item.evidenceConfidence}/100</strong><small>{item.evidenceWarnings?.length ? item.evidenceWarnings.slice(0, 2).join(" · ") : "source evidence complete"}</small></td>
                          <td><strong>{money(item.supplierRetailPriceCents)}</strong><small>{Number.isFinite(item.supplierGrossSpreadCents) ? `gross proxy spread ${money(item.supplierGrossSpreadCents)}` : "not supplied"}</small></td>
                          <td><strong>{webStatusLabel(web)}</strong><small>{Number.isFinite(web?.competitivePriceCents) ? `${money(web.competitivePriceCents)} observed · ceiling ${money(web.grossSpreadCeilingCents)}` : web?.reason || "public-web gate completed"}</small></td>
                          <td>{item.record.sourceUrl ? <a href={item.record.sourceUrl} target="_blank" rel="noopener noreferrer">Open source ↗</a> : <span className="ds-muted">Upload row {item.record.provenance?.rowNumber || "—"}</span>}</td>
                          <td><button className="ds-button ds-button-secondary ds-sourcing-verify-button" type="button" onClick={() => setSelectedCandidate(item.record)}>Verify</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {selectedCandidate && <CandidateVerificationPanel candidate={selectedCandidate} verifier={currentUser?.email || currentUser?.uid} onClose={() => setSelectedCandidate(null)} />}
        </>
      )}
    </main>
  );
};

export default SourcingWorkspace;
