import React, { useMemo, useState } from "react";
import { useAuth } from "../AuthProvider";
import { ingestBrowserDataset, prescreenBrowserCandidates } from "./browser-core.mjs";
import { adaptSsActivewearDataset } from "./ss-activewear-adapter.mjs";
import CandidateVerificationPanel from "./CandidateVerificationPanel";
import "./sourcing-workspace.css";

const dollarsToCents = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${field} must be greater than $0.`);
  return Math.round(number * 100);
};

const money = (cents) => {
  if (!Number.isFinite(cents)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
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

  const queue = prescreen?.verificationQueue || [];
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
      const nextPrescreen = prescreenBrowserCandidates(nextIntake.records, {
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

  return (
    <main className="ds-page ds-sourcing-page">
      <header className="ds-sourcing-hero">
        <div>
          <p className="ds-sourcing-eyebrow">LIVE SOURCING MVP · OWNER-UPLOAD MODE</p>
          <h1>Find eBay opportunities without scraping suppliers or eBay</h1>
          <p>Load product data you are authorized to use. DataScout normalizes it, applies supplier restrictions and source-side constraints, builds a bounded manual eBay verification queue, and calculates evidence-backed BUY / WATCH / REJECT decisions.</p>
        </div>
        <div className="ds-sourcing-safety">
          <strong>Permission-safe mode</strong>
          <span>0 automated marketplace fetches</span>
          <span>0 purchases or listings</span>
          <span>Local session only</span>
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
            <p>Prescreen ranking is not a BUY recommendation. Select a candidate and manually enter current eBay Product Research, fee and shipping evidence before DataScout will calculate a final decision.</p>
          </section>

          <section className="ds-panel ds-sourcing-queue">
            <div className="ds-sourcing-section-head">
              <div>
                <h2 className="ds-section-title">2. eBay verification queue</h2>
                <p className="ds-section-copy">Ranked only from authorized source-side evidence. Verify exact marketplace facts manually, then run the deterministic landed-economics decision.</p>
              </div>
              <span className="ds-sourcing-badge ds-sourcing-badge-yellow">YELLOW · manual verification</span>
            </div>

            {queue.length === 0 ? <div className="ds-empty">No candidates qualified for the manual eBay verification queue.</div> : (
              <div className="ds-sourcing-table-wrap">
                <table className="ds-sourcing-table">
                  <thead><tr><th>Rank</th><th>Candidate</th><th>Supplier</th><th>Source cost</th><th>MOQ outlay</th><th>Identity</th><th>Prescreen</th><th>Source</th><th>Next</th></tr></thead>
                  <tbody>
                    {queue.map((item) => (
                      <tr key={item.candidateId} className={selectedCandidate?.candidateId === item.candidateId ? "selected" : ""}>
                        <td><strong>#{item.verificationRank}</strong></td>
                        <td><strong>{item.title}</strong><small>{item.candidateId}</small></td>
                        <td>{item.supplier}</td>
                        <td>{money(item.unitCostCents)}</td>
                        <td>{money(item.initialOutlayCents)}</td>
                        <td><span className={`ds-sourcing-confidence ${item.record.identityConfidence.toLowerCase()}`}>{item.record.identityConfidence}</span></td>
                        <td><strong>{item.score}/100</strong><small>{item.warnings?.length ? item.warnings.join(" · ") : "source evidence complete"}</small></td>
                        <td>{item.record.sourceUrl ? <a href={item.record.sourceUrl} target="_blank" rel="noopener noreferrer">Open source ↗</a> : <span className="ds-muted">No URL</span>}</td>
                        <td><button className="ds-button ds-button-secondary ds-sourcing-verify-button" type="button" onClick={() => setSelectedCandidate(item.record)}>Verify</button></td>
                      </tr>
                    ))}
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
