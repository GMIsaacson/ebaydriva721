export const PUBLIC_WEB_PRECHECK_VERSION = "datascout-public-web-precheck/1.0.0";

const normalizeText = (value) => String(value || "").trim().replace(/\s+/g, " ");
const domainFromUrl = (url) => {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
};

const validateEvidenceItem = (item, candidateId) => {
  if (!item || typeof item !== "object") return null;
  if (item.candidateId && item.candidateId !== candidateId) return null;
  if (item.exactIdentityConfirmed !== true || item.packQuantityConfirmed !== true) return null;
  if (!Number.isSafeInteger(item.observedPriceCents) || item.observedPriceCents <= 0) return null;
  if (!item.url || !domainFromUrl(item.url)) return null;
  if (!item.observedAt || !Number.isFinite(Date.parse(item.observedAt))) return null;
  return Object.freeze({
    candidateId,
    observedPriceCents: item.observedPriceCents,
    url: item.url,
    domain: domainFromUrl(item.url),
    title: normalizeText(item.title),
    evidenceText: normalizeText(item.evidenceText),
    exactIdentityConfirmed: true,
    packQuantityConfirmed: true,
    observedAt: item.observedAt,
  });
};

const corroboratedEvidence = (items) => {
  const byDomain = new Map();
  for (const item of items) {
    const previous = byDomain.get(item.domain);
    if (!previous || item.observedPriceCents < previous.observedPriceCents) byDomain.set(item.domain, item);
  }
  return [...byDomain.values()].sort((a, b) => a.observedPriceCents - b.observedPriceCents || a.domain.localeCompare(b.domain));
};

const priceAgreement = (items, toleranceBps = 2500) => {
  if (items.length < 2) return false;
  const prices = items.map((item) => item.observedPriceCents).sort((a, b) => a - b);
  const low = prices[0];
  const high = prices[prices.length - 1];
  return low > 0 && Math.round(((high - low) * 10000) / low) <= toleranceBps;
};

export function assessBrowserPublicWebCompetitivePrice({ candidate, evidence = [], minProfitCents = 1500, corroborationCount = 2, agreementToleranceBps = 2500 } = {}) {
  if (!candidate?.candidateId) throw new Error("candidateId is required");
  if (!Number.isSafeInteger(candidate.unitCostCents) || candidate.unitCostCents < 0) throw new Error("candidate unitCostCents is invalid");

  const valid = corroboratedEvidence(evidence.map((item) => validateEvidenceItem(item, candidate.candidateId)).filter(Boolean));
  if (!valid.length) return {
    precheckVersion: PUBLIC_WEB_PRECHECK_VERSION,
    candidateId: candidate.candidateId,
    status: "NO_EVIDENCE",
    action: "KEEP_FOR_EBAY_VERIFY",
    reason: "no corroborated exact-match public-web price evidence",
    evidenceCount: 0,
    competitivePriceCents: null,
    grossSpreadCeilingCents: null,
    evidence: [],
  };

  const competitivePriceCents = valid[0].observedPriceCents;
  const grossSpreadCeilingCents = competitivePriceCents - candidate.unitCostCents;
  const enoughCorroboration = valid.length >= corroborationCount;
  const pricesAgree = priceAgreement(valid.slice(0, Math.max(corroborationCount, 2)), agreementToleranceBps);

  if (enoughCorroationSafe(enoughCorroboration, pricesAgree, grossSpreadCeilingCents, minProfitCents)) {
    return {
      precheckVersion: PUBLIC_WEB_PRECHECK_VERSION,
      candidateId: candidate.candidateId,
      status: "GROSS_PROFIT_IMPOSSIBLE",
      action: "DEFER_WEB_PRICE",
      reason: "corroborated public-web price leaves less than the minimum profit even before fees, shipping, packaging, and risk reserve",
      evidenceCount: valid.length,
      competitivePriceCents,
      grossSpreadCeilingCents,
      evidence: valid,
    };
  }

  const status = grossSpreadCeilingCents < minProfitCents + 1500 ? "PRICE_RISK" : "PLAUSIBLE";
  return {
    precheckVersion: PUBLIC_WEB_PRECHECK_VERSION,
    candidateId: candidate.candidateId,
    status,
    action: "KEEP_FOR_EBAY_VERIFY",
    reason: status === "PRICE_RISK" ? "thin gross spread; lower manual-research priority" : "public-web price does not eliminate the candidate",
    evidenceCount: valid.length,
    competitivePriceCents,
    grossSpreadCeilingCents,
    evidence: valid,
  };
}

function enoughCorroationSafe(enoughCorroboration, pricesAgree, grossSpreadCeilingCents, minProfitCents) {
  return enoughCorroboration && pricesAgree && grossSpreadCeilingCents < minProfitCents;
}
