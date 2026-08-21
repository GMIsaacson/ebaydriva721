import React, { useEffect, useState } from "react";
import { buildBrowserDealDecision, validateBrowserManualEbayVerification } from "./browser-decision.mjs";

const toCents = (value, field, { allowBlank = false, min = 0 } = {}) => {
  if ((value === "" || value === null || value === undefined) && allowBlank) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) throw new Error(`${field} must be at least ${min}.`);
  return Math.round(parsed * 100);
};

const percentToBps = (value, field, { min = 0, max = 100 } = {}) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new Error(`${field} must be from ${min}% to ${max}%.`);
  return Math.round(parsed * 100);
};

const money = (cents) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
const pct = (bps) => `${((bps || 0) / 100).toFixed(1)}%`;

const CandidateVerificationPanel = ({ candidate, verifier, onClose }) => {
  const [evidenceRef, setEvidenceRef] = useState("");
  const [exactIdentity, setExactIdentity] = useState(false);
  const [observationDays, setObservationDays] = useState("90");
  const [unitsSold, setUnitsSold] = useState("");
  const [avgSoldPrice, setAvgSoldPrice] = useState("");
  const [avgBuyerShipping, setAvgBuyerShipping] = useState("");
  const [activeListings, setActiveListings] = useState("");
  const [sellThrough, setSellThrough] = useState("");

  const [saleQuantity, setSaleQuantity] = useState("1");
  const [inboundFreight, setInboundFreight] = useState("0");
  const [packaging, setPackaging] = useState("1");
  const [feePercent, setFeePercent] = useState("");
  const [fixedFee, setFixedFee] = useState("");
  const [feeEvidenceRef, setFeeEvidenceRef] = useState("");
  const [riskReserve, setRiskReserve] = useState("5");
  const [shippingQuotes, setShippingQuotes] = useState("");
  const [shippingEvidenceRef, setShippingEvidenceRef] = useState("");

  const [minProfit, setMinProfit] = useState("15");
  const [minRoi, setMinRoi] = useState("30");
  const [minMargin, setMinMargin] = useState("20");
  const [minSold30, setMinSold30] = useState("5");

  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [verificationResult, setVerificationResult] = useState(null);
  const [dealResult, setDealResult] = useState(null);

  useEffect(() => {
    setEvidenceRef("");
    setExactIdentity(false);
    setUnitsSold("");
    setAvgSoldPrice("");
    setAvgBuyerShipping("");
    setActiveListings("");
    setSellThrough("");
    setVerificationResult(null);
    setDealResult(null);
    setError("");
  }, [candidate?.candidateId]);

  if (!candidate) return null;

  const runDecision = async () => {
    setRunning(true);
    setError("");
    setVerificationResult(null);
    setDealResult(null);
    try {
      const now = new Date().toISOString();
      const soldUnitsNumber = Number(unitsSold);
      if (!Number.isSafeInteger(soldUnitsNumber) || soldUnitsNumber < 0) throw new Error("Units sold must be a whole number of 0 or more.");
      const daysNumber = Number(observationDays);
      if (!Number.isSafeInteger(daysNumber) || daysNumber < 1 || daysNumber > 1095) throw new Error("Observation period must be 1–1095 days.");
      const activeNumber = activeListings === "" ? null : Number(activeListings);
      if (activeNumber !== null && (!Number.isSafeInteger(activeNumber) || activeNumber < 0)) throw new Error("Active listings must be a whole number of 0 or more.");

      const verification = validateBrowserManualEbayVerification({
        candidate,
        at: now,
        verification: {
          candidateId: candidate.candidateId,
          marketplace: "ebay-us",
          method: "ebay_product_research_manual",
          verifiedBy: verifier || "authenticated-owner",
          verifiedAt: now,
          evidenceRef,
          exactIdentityConfirmed: exactIdentity,
          observationPeriodDays: daysNumber,
          unitsSold: soldUnitsNumber,
          avgSoldPriceCents: toCents(avgSoldPrice, "Average sold price", { allowBlank: true, min: 0 }),
          activeListings: activeNumber,
          sellThroughBps: sellThrough === "" ? null : percentToBps(sellThrough, "Sell-through"),
          avgShippingCents: toCents(avgBuyerShipping, "Average buyer shipping", { allowBlank: true, min: 0 }),
          acceptedOfferPricesIncluded: null,
        },
      });
      setVerificationResult(verification);
      if (verification.status !== "VERIFIED") return;

      const parsedQuotes = shippingQuotes.split(",").map((value) => value.trim()).filter(Boolean).map((value, index) => toCents(value, `Shipping quote ${index + 1}`, { min: 0 }));
      if (!parsedQuotes.length) throw new Error("Enter at least one current outbound shipping quote.");
      const quantity = Number(saleQuantity);
      if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error("Sale quantity must be a positive whole number.");
      const soldPer30Target = Number(minSold30);
      if (!Number.isFinite(soldPer30Target) || soldPer30Target <= 0) throw new Error("Minimum 30-day sold rate must be greater than zero.");

      const deal = await buildBrowserDealDecision({
        candidate,
        marketplaceVerification: verification,
        saleUnitQuantity: quantity,
        inboundFreightPerSaleCents: toCents(inboundFreight, "Inbound freight", { min: 0 }),
        packagingCents: toCents(packaging, "Packaging", { min: 0 }),
        marketplaceFeeBps: percentToBps(feePercent, "Marketplace fee"),
        marketplaceFixedFeeCents: toCents(fixedFee, "Marketplace fixed fee", { min: 0 }),
        feeEvidenceRef,
        riskReserveBps: percentToBps(riskReserve, "Risk reserve"),
        shippingQuote: { capturedAt: now, evidenceRef: shippingEvidenceRef, quotesCents: parsedQuotes },
        decisionPolicy: {
          minBuyProfitCents: toCents(minProfit, "Minimum BUY profit", { min: 0.01 }),
          minBuyRoiBps: percentToBps(minRoi, "Minimum BUY ROI", { min: 0.01 }),
          minBuyMarginBps: percentToBps(minMargin, "Minimum BUY margin", { min: 0.01 }),
          minBuySoldPer30Days: soldPer30Target,
        },
        at: now,
      });
      setDealResult(deal);
    } catch (runError) {
      console.error("Candidate verification failed:", runError);
      setError(runError.message || "Candidate verification could not be completed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="ds-panel ds-verification-panel">
      <div className="ds-sourcing-section-head">
        <div>
          <p className="ds-verification-step">3. MANUAL MARKETPLACE VERIFICATION + ECONOMICS</p>
          <h2 className="ds-section-title">{candidate.title}</h2>
          <p className="ds-section-copy">{candidate.supplier} · {candidate.candidateId} · source cost {money(candidate.unitCostCents)} / source pack of {candidate.packQuantity}</p>
        </div>
        <button className="ds-button ds-button-secondary" type="button" onClick={onClose}>Close</button>
      </div>

      <div className="ds-verification-callout">
        Open eBay Product Research manually in your seller account, confirm the exact product/pack/condition, then enter the observed facts below. DataScout does not open or automate eBay.
      </div>

      <div className="ds-verification-grid">
        <div className="ds-verification-group">
          <h3>eBay evidence</h3>
          <label><span className="ds-label">Evidence reference / note</span><input value={evidenceRef} onChange={(event) => setEvidenceRef(event.target.value)} placeholder="e.g. Product Research checked 9:42 PM" /></label>
          <label className="ds-sourcing-attestation"><input type="checkbox" checked={exactIdentity} onChange={(event) => setExactIdentity(event.target.checked)} /><span>I confirmed exact product, pack quantity and condition.</span></label>
          <div className="ds-verification-mini-grid">
            <label><span className="ds-label">Observation days</span><input type="number" min="1" max="1095" value={observationDays} onChange={(event) => setObservationDays(event.target.value)} /></label>
            <label><span className="ds-label">Units sold</span><input type="number" min="0" step="1" value={unitsSold} onChange={(event) => setUnitsSold(event.target.value)} /></label>
            <label><span className="ds-label">Avg sold price</span><input type="number" min="0" step="0.01" value={avgSoldPrice} onChange={(event) => setAvgSoldPrice(event.target.value)} placeholder="$" /></label>
            <label><span className="ds-label">Avg buyer shipping</span><input type="number" min="0" step="0.01" value={avgBuyerShipping} onChange={(event) => setAvgBuyerShipping(event.target.value)} placeholder="optional" /></label>
            <label><span className="ds-label">Active listings</span><input type="number" min="0" step="1" value={activeListings} onChange={(event) => setActiveListings(event.target.value)} placeholder="optional" /></label>
            <label><span className="ds-label">Sell-through %</span><input type="number" min="0" max="100" step="0.01" value={sellThrough} onChange={(event) => setSellThrough(event.target.value)} placeholder="optional" /></label>
          </div>
        </div>

        <div className="ds-verification-group">
          <h3>Costs + current evidence</h3>
          <div className="ds-verification-mini-grid">
            <label><span className="ds-label">Units in one eBay sale</span><input type="number" min="1" step="1" value={saleQuantity} onChange={(event) => setSaleQuantity(event.target.value)} /></label>
            <label><span className="ds-label">Inbound freight / sale</span><input type="number" min="0" step="0.01" value={inboundFreight} onChange={(event) => setInboundFreight(event.target.value)} /></label>
            <label><span className="ds-label">Packaging / sale</span><input type="number" min="0" step="0.01" value={packaging} onChange={(event) => setPackaging(event.target.value)} /></label>
            <label><span className="ds-label">eBay fee %</span><input type="number" min="0" max="100" step="0.01" value={feePercent} onChange={(event) => setFeePercent(event.target.value)} placeholder="enter current rate" /></label>
            <label><span className="ds-label">Fixed fee</span><input type="number" min="0" step="0.01" value={fixedFee} onChange={(event) => setFixedFee(event.target.value)} placeholder="enter current fee" /></label>
            <label><span className="ds-label">Risk reserve %</span><input type="number" min="0" max="100" step="0.1" value={riskReserve} onChange={(event) => setRiskReserve(event.target.value)} /></label>
          </div>
          <label><span className="ds-label">Fee evidence reference</span><input value={feeEvidenceRef} onChange={(event) => setFeeEvidenceRef(event.target.value)} placeholder="current official fee schedule reference" /></label>
          <label><span className="ds-label">Outbound shipping quotes ($, comma-separated)</span><input value={shippingQuotes} onChange={(event) => setShippingQuotes(event.target.value)} placeholder="8.75, 11.20, 14.80" /></label>
          <label><span className="ds-label">Shipping evidence reference</span><input value={shippingEvidenceRef} onChange={(event) => setShippingEvidenceRef(event.target.value)} placeholder="carrier/rate-calculator check reference" /></label>
        </div>

        <div className="ds-verification-group ds-verification-thresholds">
          <h3>Owner BUY thresholds</h3>
          <p>These are editable working thresholds, not purchase authority.</p>
          <div className="ds-verification-mini-grid">
            <label><span className="ds-label">Min profit</span><input type="number" min="0.01" step="0.01" value={minProfit} onChange={(event) => setMinProfit(event.target.value)} /></label>
            <label><span className="ds-label">Min ROI %</span><input type="number" min="0.01" max="100" step="0.1" value={minRoi} onChange={(event) => setMinRoi(event.target.value)} /></label>
            <label><span className="ds-label">Min margin %</span><input type="number" min="0.01" max="100" step="0.1" value={minMargin} onChange={(event) => setMinMargin(event.target.value)} /></label>
            <label><span className="ds-label">Min sold / 30 days</span><input type="number" min="0.01" step="0.1" value={minSold30} onChange={(event) => setMinSold30(event.target.value)} /></label>
          </div>
          <button className="ds-button ds-button-primary" type="button" disabled={running} onClick={runDecision}>{running ? "Calculating…" : "Verify + calculate decision"}</button>
        </div>
      </div>

      {error && <div className="ds-sourcing-alert ds-sourcing-alert-error">{error}</div>}

      {verificationResult && verificationResult.status !== "VERIFIED" && (
        <div className={`ds-decision-card ${verificationResult.status.toLowerCase()}`}>
          <span>Marketplace evidence: {verificationResult.status}</span>
          <strong>{verificationResult.reason}</strong>
          <small>No BUY calculation was allowed.</small>
        </div>
      )}

      {dealResult && (
        <div className={`ds-decision-card ${String(dealResult.decision || dealResult.status).toLowerCase()}`}>
          <span>DataScout decision</span>
          <strong>{dealResult.decision || dealResult.status}</strong>
          {dealResult.status === "COMPLETE" ? (
            <div className="ds-decision-metrics">
              <div><small>Net profit</small><b>{money(dealResult.economics.netProfitCents)}</b></div>
              <div><small>ROI</small><b>{pct(dealResult.economics.roiBps)}</b></div>
              <div><small>Margin</small><b>{pct(dealResult.economics.marginBps)}</b></div>
              <div><small>Sold / 30d</small><b>{dealResult.soldPer30Days}</b></div>
              <div><small>Modeled shipping</small><b>{money(dealResult.shipping.outboundShippingCents)}</b></div>
              <div><small>Break-even revenue</small><b>{money(dealResult.economics.breakEvenCollectedRevenueCents)}</b></div>
            </div>
          ) : <p>{dealResult.reason}</p>}
          {dealResult.reasons?.length > 0 && <p>{dealResult.reasons.join(" · ")}</p>}
          <small>Decision support only. No purchase or listing action is performed.</small>
        </div>
      )}
    </section>
  );
};

export default CandidateVerificationPanel;
