export const BROWSER_DECISION_VERSION = "datascout-browser-decision/1.0.0";
export const FORMULA_VERSION = "datascout-landed-economics/1.0.0";
export const DEFAULT_MARKETPLACE_MAX_AGE_HOURS = 72;
export const DEFAULT_SHIPPING_MAX_AGE_HOURS = 72;

const REQUIRED_FIELDS = Object.freeze([
  "collectedRevenueCents",
  "sourceCostCents",
  "inboundFreightCents",
  "marketplaceFeesCents",
  "outboundShippingCents",
  "packagingCents",
  "riskReserveCents",
]);

function nonEmpty(value, field) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${field} is required`);
  return text;
}

function integerOrNull(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error(`${field} must be an integer from ${min} to ${max}`);
  return parsed;
}

function requireSafeInteger(value, field, min = 0) {
  if (!Number.isSafeInteger(value) || value < min) throw new Error(`${field} must be a safe integer >= ${min}`);
  return value;
}

function requirePositiveNumber(value, field) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${field} must be greater than 0`);
  return value;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((result, key) => {
      result[key] = canonicalize(value[key]);
      return result;
    }, {});
  }
  return value;
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function calculateEconomics(input) {
  const normalized = Object.fromEntries(REQUIRED_FIELDS.map((field) => [field, input[field]]));
  const missing = REQUIRED_FIELDS.filter((field) => normalized[field] === undefined || normalized[field] === null);
  const invalid = REQUIRED_FIELDS.filter((field) => normalized[field] !== undefined && (!Number.isSafeInteger(normalized[field]) || normalized[field] < 0));
  if (Number.isSafeInteger(normalized.collectedRevenueCents) && normalized.collectedRevenueCents <= 0) invalid.push("collectedRevenueCents");
  const inputHash = await sha256Hex(JSON.stringify(canonicalize(normalized)));
  if (missing.length || invalid.length) {
    return { status: "Incomplete", formulaVersion: FORMULA_VERSION, inputHash, missing: [...new Set(missing)], invalid: [...new Set(invalid)] };
  }
  const totalCostCents = normalized.sourceCostCents + normalized.inboundFreightCents + normalized.marketplaceFeesCents + normalized.outboundShippingCents + normalized.packagingCents + normalized.riskReserveCents;
  const netProfitCents = normalized.collectedRevenueCents - totalCostCents;
  return {
    status: "Complete",
    formulaVersion: FORMULA_VERSION,
    inputHash,
    collectedRevenueCents: normalized.collectedRevenueCents,
    totalCostCents,
    netProfitCents,
    marginBps: Math.round((netProfitCents / normalized.collectedRevenueCents) * 10000),
    roiBps: totalCostCents === 0 ? null : Math.round((netProfitCents / totalCostCents) * 10000),
    breakEvenCollectedRevenueCents: totalCostCents,
  };
}

export function validateBrowserManualEbayVerification({ candidate, verification: raw, at = new Date().toISOString(), maxAgeHours = DEFAULT_MARKETPLACE_MAX_AGE_HOURS } = {}) {
  if (!candidate || typeof candidate !== "object") throw new Error("candidate is required");
  if (!raw || typeof raw !== "object") throw new Error("verification is required");
  if (!Number.isFinite(Date.parse(at))) throw new Error("evaluation time must be valid ISO date-time");
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0 || maxAgeHours > 168) throw new Error("maxAgeHours must be greater than 0 and no more than 168");

  const candidateId = nonEmpty(raw.candidateId, "candidateId");
  if (candidateId !== candidate.candidateId) throw new Error("verification candidateId does not match candidate");
  if (nonEmpty(raw.marketplace, "marketplace").toLowerCase() !== "ebay-us") throw new Error("marketplace must be ebay-us");
  const method = nonEmpty(raw.method, "method");
  if (!["ebay_product_research_manual", "ebay_manual_completed_listing"].includes(method)) throw new Error("unsupported manual verification method");
  const verifiedBy = nonEmpty(raw.verifiedBy, "verifiedBy");
  const verifiedAt = nonEmpty(raw.verifiedAt, "verifiedAt");
  if (!Number.isFinite(Date.parse(verifiedAt))) throw new Error("verifiedAt must be a valid ISO date-time");
  const evidenceRef = nonEmpty(raw.evidenceRef, "evidenceRef");
  if (typeof raw.exactIdentityConfirmed !== "boolean") throw new Error("exactIdentityConfirmed must be boolean");
  const observationPeriodDays = integerOrNull(raw.observationPeriodDays, "observationPeriodDays", { min: 1, max: 1095 });
  if (observationPeriodDays === null) throw new Error("observationPeriodDays is required");
  const unitsSold = integerOrNull(raw.unitsSold, "unitsSold", { min: 0 });
  if (unitsSold === null) throw new Error("unitsSold is required");
  const avgSoldPriceCents = integerOrNull(raw.avgSoldPriceCents, "avgSoldPriceCents", { min: 0 });
  const activeListings = integerOrNull(raw.activeListings, "activeListings", { min: 0 });
  const sellThroughBps = integerOrNull(raw.sellThroughBps, "sellThroughBps", { min: 0, max: 10000 });
  const avgShippingCents = integerOrNull(raw.avgShippingCents, "avgShippingCents", { min: 0 });
  if (raw.acceptedOfferPricesIncluded !== undefined && raw.acceptedOfferPricesIncluded !== null && typeof raw.acceptedOfferPricesIncluded !== "boolean") throw new Error("acceptedOfferPricesIncluded must be boolean or null");

  const verification = {
    schemaVersion: "1.0.0",
    candidateId,
    marketplace: "ebay-us",
    method,
    verifiedBy,
    verifiedAt,
    evidenceRef,
    searchQuery: raw.searchQuery === undefined || raw.searchQuery === null ? null : String(raw.searchQuery).trim() || null,
    exactIdentityConfirmed: raw.exactIdentityConfirmed,
    observationPeriodDays,
    unitsSold,
    avgSoldPriceCents,
    activeListings,
    sellThroughBps,
    avgShippingCents,
    acceptedOfferPricesIncluded: raw.acceptedOfferPricesIncluded ?? null,
  };

  const base = { schemaVersion: "1.0.0", candidateId, marketplace: "ebay-us", verification, sourceAccess: { sourceId: "ebay-manual-verification", classification: "YELLOW", accessMode: "manual_verification", machineFetchAllowed: false }, marketplaceFetches: 0, machineFetches: 0, externalActions: 0, spendingCents: 0 };
  const ageHours = (Date.parse(at) - Date.parse(verifiedAt)) / 3600000;
  if (ageHours < 0) return { ...base, status: "REVIEW", reason: "verification timestamp is in the future", ageHours };
  if (ageHours > maxAgeHours) return { ...base, status: "REVIEW", reason: "marketplace verification is stale", ageHours };
  if (!verification.exactIdentityConfirmed) return { ...base, status: "REVIEW", reason: "exact marketplace identity was not confirmed", ageHours };
  if (verification.unitsSold === 0) return { ...base, status: "REJECT", reason: "no sold evidence observed in the selected period", ageHours };
  if (verification.avgSoldPriceCents === null || verification.avgSoldPriceCents <= 0) return { ...base, status: "INCOMPLETE", reason: "average sold price is required when sold units are present", ageHours };
  const soldPer30Days = Math.round((verification.unitsSold / verification.observationPeriodDays) * 30 * 100) / 100;
  return { ...base, status: "VERIFIED", reason: "current manual eBay evidence accepted for deterministic economics", ageHours, soldPer30Days };
}

function validateDecisionPolicy(policy) {
  if (!policy || typeof policy !== "object") throw new Error("decisionPolicy is required");
  return {
    minBuyProfitCents: requireSafeInteger(policy.minBuyProfitCents, "minBuyProfitCents", 1),
    minBuyRoiBps: requireSafeInteger(policy.minBuyRoiBps, "minBuyRoiBps", 1),
    minBuyMarginBps: requireSafeInteger(policy.minBuyMarginBps, "minBuyMarginBps", 1),
    minBuySoldPer30Days: requirePositiveNumber(policy.minBuySoldPer30Days, "minBuySoldPer30Days"),
  };
}

function conservativeShippingQuote(shippingQuote, at, maxAgeHours = DEFAULT_SHIPPING_MAX_AGE_HOURS) {
  if (!shippingQuote || typeof shippingQuote !== "object") return { status: "INCOMPLETE", reason: "shipping quote is required" };
  if (!Number.isFinite(Date.parse(at))) throw new Error("evaluation time must be valid ISO date-time");
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0 || maxAgeHours > 168) throw new Error("shipping maxAgeHours must be > 0 and <= 168");
  if (!Number.isFinite(Date.parse(shippingQuote.capturedAt))) return { status: "INCOMPLETE", reason: "shipping capturedAt is required and must be valid" };
  const evidenceRef = String(shippingQuote.evidenceRef || "").trim();
  if (!evidenceRef) return { status: "INCOMPLETE", reason: "shipping evidenceRef is required" };
  if (!Array.isArray(shippingQuote.quotesCents) || shippingQuote.quotesCents.length < 1) return { status: "INCOMPLETE", reason: "at least one shipping quote is required" };
  const quotes = shippingQuote.quotesCents.map((value, index) => requireSafeInteger(value, `shipping quote ${index + 1}`, 0));
  const ageHours = (Date.parse(at) - Date.parse(shippingQuote.capturedAt)) / 3600000;
  if (ageHours < 0) return { status: "REVIEW", reason: "shipping quote timestamp is in the future", ageHours };
  if (ageHours > maxAgeHours) return { status: "REVIEW", reason: "shipping quote is stale", ageHours };
  return { status: "READY", strategy: "CONSERVATIVE_MAX", outboundShippingCents: Math.max(...quotes), quotesCents: [...quotes], evidenceRef, capturedAt: shippingQuote.capturedAt, ageHours };
}

export async function buildBrowserDealDecision({
  candidate,
  marketplaceVerification,
  saleUnitQuantity,
  inboundFreightPerSaleCents,
  packagingCents,
  marketplaceFeeBps,
  marketplaceFixedFeeCents,
  feeEvidenceRef,
  riskReserveBps,
  shippingQuote,
  decisionPolicy,
  at = new Date().toISOString(),
  shippingMaxAgeHours = DEFAULT_SHIPPING_MAX_AGE_HOURS,
  marketplaceMaxAgeHours = DEFAULT_MARKETPLACE_MAX_AGE_HOURS,
} = {}) {
  if (!candidate || typeof candidate !== "object") throw new Error("candidate is required");
  if (!Number.isFinite(Date.parse(at))) throw new Error("evaluation time must be valid ISO date-time");
  if (!Number.isFinite(marketplaceMaxAgeHours) || marketplaceMaxAgeHours <= 0 || marketplaceMaxAgeHours > 168) throw new Error("marketplaceMaxAgeHours must be > 0 and <= 168");
  if (!marketplaceVerification || marketplaceVerification.status !== "VERIFIED") return { status: "BLOCKED", decision: null, reason: "fresh verified marketplace evidence is required", candidateId: candidate.candidateId || null, externalActions: 0, spendingCents: 0 };
  if (marketplaceVerification.candidateId !== candidate.candidateId) throw new Error("marketplace verification candidate does not match candidate");

  const verification = marketplaceVerification.verification;
  if (!verification || !Number.isFinite(Date.parse(verification.verifiedAt))) return { status: "INCOMPLETE", decision: null, reason: "marketplace verification timestamp is missing", candidateId: candidate.candidateId, externalActions: 0, spendingCents: 0 };
  const marketplaceAgeHours = (Date.parse(at) - Date.parse(verification.verifiedAt)) / 3600000;
  if (marketplaceAgeHours < 0) return { status: "REVIEW", decision: null, reason: "marketplace verification timestamp is in the future", candidateId: candidate.candidateId, marketplaceAgeHours, externalActions: 0, spendingCents: 0 };
  if (marketplaceAgeHours > marketplaceMaxAgeHours) return { status: "REVIEW", decision: null, reason: "marketplace verification is stale at decision time", candidateId: candidate.candidateId, marketplaceAgeHours, externalActions: 0, spendingCents: 0 };

  const policy = validateDecisionPolicy(decisionPolicy);
  const qty = requireSafeInteger(saleUnitQuantity, "saleUnitQuantity", 1);
  const sourcePackQty = requireSafeInteger(candidate.packQuantity, "candidate.packQuantity", 1);
  requireSafeInteger(candidate.unitCostCents, "candidate.unitCostCents", 0);
  const allocatedSourceCostCents = Math.ceil((candidate.unitCostCents / sourcePackQty) * qty);
  const inbound = requireSafeInteger(inboundFreightPerSaleCents, "inboundFreightPerSaleCents", 0);
  const packaging = requireSafeInteger(packagingCents, "packagingCents", 0);
  const feeBps = requireSafeInteger(marketplaceFeeBps, "marketplaceFeeBps", 0);
  if (feeBps > 10000) throw new Error("marketplaceFeeBps must be <= 10000");
  const fixedFee = requireSafeInteger(marketplaceFixedFeeCents, "marketplaceFixedFeeCents", 0);
  const feeEvidence = String(feeEvidenceRef || "").trim();
  if (!feeEvidence) return { status: "INCOMPLETE", decision: null, reason: "marketplace fee evidence is required", candidateId: candidate.candidateId, externalActions: 0, spendingCents: 0 };
  const reserveBps = requireSafeInteger(riskReserveBps, "riskReserveBps", 0);
  if (reserveBps > 10000) throw new Error("riskReserveBps must be <= 10000");

  const shipping = conservativeShippingQuote(shippingQuote, at, shippingMaxAgeHours);
  if (shipping.status !== "READY") return { status: shipping.status, decision: null, reason: shipping.reason, candidateId: candidate.candidateId, shipping, externalActions: 0, spendingCents: 0 };

  const itemSalePriceCents = requireSafeInteger(verification.avgSoldPriceCents, "avgSoldPriceCents", 1);
  const buyerShippingCollectedCents = verification.avgShippingCents === null || verification.avgShippingCents === undefined ? 0 : requireSafeInteger(verification.avgShippingCents, "avgShippingCents", 0);
  const collectedRevenueCents = itemSalePriceCents + buyerShippingCollectedCents;
  const marketplaceFeesCents = Math.ceil((collectedRevenueCents * feeBps) / 10000) + fixedFee;
  const riskReserveCents = Math.ceil((collectedRevenueCents * reserveBps) / 10000);
  const economics = await calculateEconomics({ collectedRevenueCents, sourceCostCents: allocatedSourceCostCents, inboundFreightCents: inbound, marketplaceFeesCents, outboundShippingCents: shipping.outboundShippingCents, packagingCents: packaging, riskReserveCents });
  if (economics.status !== "Complete") return { status: "INCOMPLETE", decision: null, reason: "landed economics are incomplete", candidateId: candidate.candidateId, economics, externalActions: 0, spendingCents: 0 };

  let decision;
  const reasons = [];
  if (economics.netProfitCents <= 0 || economics.roiBps === null || economics.roiBps <= 0) {
    decision = "REJECT";
    reasons.push("non-positive landed profit/ROI");
  } else {
    const misses = [];
    if (economics.netProfitCents < policy.minBuyProfitCents) misses.push("profit below BUY target");
    if (economics.roiBps < policy.minBuyRoiBps) misses.push("ROI below BUY target");
    if (economics.marginBps < policy.minBuyMarginBps) misses.push("margin below BUY target");
    if (marketplaceVerification.soldPer30Days < policy.minBuySoldPer30Days) misses.push("30-day sold rate below BUY target");
    if (misses.length) { decision = "WATCH"; reasons.push(...misses); }
    else { decision = "BUY"; reasons.push("all owner BUY thresholds passed"); }
  }

  return {
    schemaVersion: "1.0.0",
    coreVersion: BROWSER_DECISION_VERSION,
    status: "COMPLETE",
    decision,
    reasons,
    candidateId: candidate.candidateId,
    saleUnitQuantity: qty,
    sourcePackQuantity: sourcePackQty,
    allocatedSourceCostCents,
    itemSalePriceCents,
    buyerShippingCollectedCents,
    marketplaceFeeBps: feeBps,
    marketplaceFixedFeeCents: fixedFee,
    marketplaceFeeEvidenceRef: feeEvidence,
    riskReserveBps: reserveBps,
    shipping,
    economics,
    soldPer30Days: marketplaceVerification.soldPer30Days,
    marketplaceAgeHours,
    decisionPolicy: policy,
    externalActions: 0,
    machineFetches: 0,
    marketplaceFetches: 0,
    spendingCents: 0,
  };
}
