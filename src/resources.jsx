import React from "react";
import { Link } from "react-router-dom";

const Calculators = () => (
  <main className="ds-page">
    <section className="ds-panel" style={{ maxWidth: "760px", margin: "56px auto", padding: "28px" }}>
      <p style={{ margin: 0, color: "var(--ds-blue-600)", fontSize: ".75rem", fontWeight: 800, letterSpacing: ".07em" }}>
        PROFITABILITY ENGINE UPDATED
      </p>
      <h1 style={{ margin: "8px 0 10px", color: "var(--ds-navy-950)", letterSpacing: "-.035em" }}>
        Use Live Sourcing for eBay profitability decisions
      </h1>
      <p className="ds-section-copy" style={{ fontSize: ".98rem" }}>
        The former calculator used fixed marketplace-fee and shipping assumptions. It has been retired so DataScout does not present stale estimates as authoritative economics.
      </p>
      <p className="ds-section-copy" style={{ marginTop: "12px" }}>
        Live Sourcing requires current eBay evidence, explicit fee provenance, current shipping quotes, packaging/inbound costs and a risk reserve before calculating profit, margin, ROI, break-even and BUY / WATCH / REJECT.
      </p>
      <div style={{ marginTop: "22px" }}>
        <Link className="ds-button ds-button-primary" to="/sourcing">Open Live Sourcing</Link>
      </div>
    </section>
  </main>
);

export default Calculators;
