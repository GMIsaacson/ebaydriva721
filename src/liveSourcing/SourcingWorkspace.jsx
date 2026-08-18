import React, { useMemo, useState } from "react";
import { useAuth } from "../AuthProvider";
import { ingestBrowserDataset } from "./browser-core.mjs";
import { prescreenBrowserCandidates } from "./prescreen-v2.mjs";
import { assessBrowserPublicWebCompetitivePrice } from "./public-web-precheck.mjs";
import { adaptSsActivewearDataset } from "./ss-activewear-adapter.mjs";
import CandidateVerificationPanel from "./CandidateVerificationPanel";
import "./sourcing-workspace.css";

const PUBLIC_WEB_PRECHECK_URL = "https://qxbstimgqkzqzzezwijw.supabase.co/functions/v1/datascout-public-web-precheck";
const PUBLIC_WEB_BATCH_LIMIT = 10;
const PUBLIC_WEB_BATCH_MAX_COST_USD = 0.05;
const PUBLIC_WEB_MIN_PROFIT_CENTS = 1500;

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
  if (!assessment) return "Not checked";
  if (assessment.status === "GROSS_PROFIT_IMPOSSIBLE") return "DEFER WEB PRICE";
  if (assessment.status === "PRICE_RISK") return "PRICE RISK";
  if (assessment.status === "PLAUSIBLE") return "PLAUSIBLE";
  return "NO EXACT PRICE";
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

  const queue = prescreen?.verificationQueue || [];
  const webDeferredCount = Object.values(publicWebResults).filter((result) => result?.action === "DEFER_WEB_PRICE").length;
  const webCheckedCount = Object.keys(publicWebResults).length;

  const summary = useMemo(() => {
    if (!intake || !prescreen) return null;
    const supplierRestricted = supplierAdapter?.detected ? supplierAdapter.prohibitedCount : 0;
    const supplierReview = supplierAdapter?.detected ? supplierAdapter.reviewCount : 0;
    return {
      input: supplierAdapter?.detected ? supplierAdapter.inputCount : intake.inputCount,
      accepted: intake.acceptedCount,
      verify: prescreen.verificationCount,
      deferred: prescreen.deferredCount,
      review: supplierReview + intake.reviewCount + prescreen.reviewCount + intake.invalidCount,
      rejected: supplierRestricted + prescreen.rejectedCount,
      supplierRestricted,
    };
  }, [intake, prescreen, supplierAdapter]);

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
      const exactCandidates = queue.filter((item) => item.record?.upc || item.record?.mpn).slice(0, PUBLIC_WEB_BATCH_LIMIT);
      if (!exactCandidates.length) throw new Error("No queued candidates have a GTIN/UPC or MPN suitable for exact-match automated price checks.");
      const token = await currentUser.getIdToken();
      const response = await fetch(PUBLIC_WEB_PRECHECK_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          approvedMaxCostUsd: PUBLIC_WEB_BATCH_MAX_COST_USD,
          candidates: exactCandidates.map((item) => ({
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

      const nextResults = {};
      for (const check of payload.checks || []) {
        const queued = queue.find((item) => item.candidateId === check.candidateId);
        if (!queued) continue;
        nextResults[check.candidateId] = assessBrowserPublicWebCompetitivePrice({
          candidate: queued.record,
          evidence: check.evidence || [],
          minProfitCents: PUBLIC_WEB_MIN_PROFIT_CENTS,
        });
      }
      setPublicWebResults(nextResults);
      setPublicWebMeta({ estimatedCostUsd: payload.estimatedCostUsd, actualSearchRequests: payload.actualSearchRequests, provider: payload.provider });
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
          <p>Load product data you are authorized to use. DataScout normalizes it, applies supplier restrictions and source-side constraints, ranks research priority, optionally checks public-web competitive prices, builds a bounded manual eBay verification queue, and calculates evidence-backed BUY / WATCH / REJECT decisions.</p>
        </div>
        <div className="ds-sourcing-safety">
          <strong>Permission-safe mode</strong>
          <span>0 automated eBay fetches</span>
          <span>0 purchases or listings</span>
          <span>Public-web search only when approved</span>
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
          <label><span className="ds-label">Max eBay verification queue</span><input type="number" min="1" max="100" step="1" value={queueSize} onChange={(event) => setQueueSize(event.target.value)} /></label>
          <label><span className="ds-label">Excluded terms</span><input value={excludedTerms} onChange={(event) => setExcludedTerms(event.target.value)} placeholder="e.g. hazmat, lithium battery" /></label>
        </div>

        <label className="ds-sourcing-attestation"><input type="checkbox" checked={ownerAttestation} onChange={(event) => setOwnerAttestation(event.target.checked)} /><span>I confirm I am authorized to use and privately analyze this uploaded product data.</span></label>
        {error && <div className="ds-sourcing-alert ds-sourcing-alert-error">{error}</div>}
        <div className="ds-sourcing-actions">
          <button className="ds-button ds-button-primary" type="button" disabled={running} onClick={buildQueue}>{running ? "Analyzing…" : "Build verification queue"}</button>
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
            <div className="ds-kpi"><span className="ds-kpi-label">Verify on eBay</span><div className="ds-kpi-value">{summary.verify}</div></div>
            <div className="ds-kpi"><span className="ds-kpi-label">Deferred</span><div className="ds-kpi-value">{summary.deferred}</div></div>
          </section>

          <section className="ds-panel ds-sourcing-summary">
            <div className="ds-sourcing-summary-row">
              <div><strong>{summary.review}</strong><span>need data review</span></div>
              <div><strong>{summary.rejected}</strong><span>source/restriction rejects</span></div>
              <div><strong>0</strong><span>eBay fetches</span></div>
              <div><strong>0</strong><span>external actions</span></div>
            </div>
            <p><strong>Opportunity Score</strong> ranks how worthwhile a product is to research using supplier-side evidence only. <strong>Evidence Confidence</strong> separately measures how complete that evidence is. Supplier retail price is a research proxy only—not an assumed eBay selling price and not a BUY recommendation.</p>
          </section>

          <section className="ds-panel ds-sourcing-summary">
            <div className="ds-sourcing-section-head">
              <div>
                <h2 className="ds-section-title">1.5 Public-web competitive-price precheck</h2>
                <p className="ds-section-copy">Checks up to the top 10 exact-identity candidates through a search API. It does not scrape eBay or retailer pages and cannot establish sold demand.</p>
              </div>
              <span className="ds-sourcing-badge">GREEN · search API</span>
            </div>
            <p>One click authorizes up to <strong>$0.05</strong> for this batch (10 searches maximum). A candidate is auto-deferred only when at least two independent exact-match price sources agree closely enough and the gross spread is already below the working $15 minimum profit <em>before</em> fees, shipping, packaging and risk reserve.</p>
            {publicWebError && <div className="ds-sourcing-alert ds-sourcing-alert-error">{publicWebError}</div>}
            {publicWebMeta && <p><strong>{webCheckedCount}</strong> checked · <strong>{webDeferredCount}</strong> web-price defer(s) · estimated search cost ${Number(publicWebMeta.estimatedCostUsd || 0).toFixed(2)} · {publicWebMeta.provider}</p>}
            <div className="ds-sourcing-actions">
              <button className="ds-button ds-button-primary" type="button" disabled={publicWebRunning || !queue.length} onClick={runPublicWebPrecheck}>{publicWebRunning ? "Checking public prices…" : "Precheck top 10 · max $0.05"}</button>
            </div>
          </section>

          <section className="ds-panel ds-sourcing-queue">
            <div className="ds-sourcing-section-head">
              <div>
                <h2 className="ds-section-title">2. eBay verification queue</h2>
                <p className="ds-section-copy">Ranked from authorized supplier-side evidence. Public-web price evidence can eliminate obvious margin failures; exact eBay demand still requires manual Product Research.</p>
              </div>
              <span className="ds-sourcing-badge ds-sourcing-badge-yellow">YELLOW · manual verification</span>
            </div>

            {queue.length === 0 ? <div className="ds-empty">No candidates qualified for the manual eBay verification queue.</div> : (
              <div className="ds-sourcing-table-wrap">
                <table className="ds-sourcing-table">
                  <thead><tr><th>Rank</th><th>Candidate</th><th>Supplier</th><th>Source cost</th><th>MOQ / outlay</th><th>Identity</th><th>Opportunity</th><th>Evidence</th><th>Supplier retail proxy</th><th>Web precheck</th><th>Source</th><th>Next</th></tr></thead>
                  <tbody>
                    {queue.map((item) => {
                      const web = publicWebResults[item.candidateId];
                      const blocked = web?.action === "DEFER_WEB_PRICE";
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
                          <td><strong>{webStatusLabel(web)}</strong><small>{web ? `${money(web.competitivePriceCents)} observed · ceiling ${money(web.grossSpreadCeilingCents)}` : "optional before eBay research"}</small></td>
                          <td>{item.record.sourceUrl ? <a href={item.record.sourceUrl} target="_blank" rel="noopener noreferrer">Open source ↗</a> : <span className="ds-muted">Upload row {item.record.provenance?.rowNumber || "—"}</span>}</td>
                          <td><button className="ds-button ds-button-secondary ds-sourcing-verify-button" type="button" disabled={blocked} title={blocked ? web.reason : "Open manual eBay verification"} onClick={() => setSelectedCandidate(item.record)}>{blocked ? "Deferred" : "Verify"}</button></td>
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
