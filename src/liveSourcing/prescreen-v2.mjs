export const PRESCREEN_VERSION = "datascout-prescreen/2.0.0";

function validatePolicy(policyInput = {}) {
  const policy = {
    marketplace: "ebay-us",
    currency: "USD",
    maxVerificationQueue: 50,
    maxSourceCostCents: 10000,
    maxInitialOutlayCents: 50000,
    excludedTerms: [],
    ...(policyInput || {}),
  };
  if (policy.marketplace !== "ebay-us") throw new Error("marketplace must remain ebay-us for this MVP");
  if (policy.currency !== "USD") throw new Error("currency must remain USD for this MVP");
  if (!Number.isSafeInteger(policy.maxVerificationQueue) || policy.maxVerificationQueue < 1 || policy.maxVerificationQueue > 100) throw new Error("Verification queue must be 1 to 100.");
  if (!Number.isSafeInteger(policy.maxSourceCostCents) || policy.maxSourceCostCents < 1) throw new Error("Maximum source cost must be positive.");
  if (!Number.isSafeInteger(policy.maxInitialOutlayCents) || policy.maxInitialOutlayCents < 1) throw new Error("Maximum initial outlay must be positive.");
  if (!Array.isArray(policy.excludedTerms)) throw new Error("excludedTerms must be an array.");
  return {
    ...policy,
    excludedTerms: policy.excludedTerms.map((term) => String(term).trim().toLowerCase()).filter(Boolean),
  };
}

function containsExcludedTerm(record, excludedTerms) {
  if (!excludedTerms.length) return null;
  const haystack = [record.title, record.category, record.condition, record.brand].filter(Boolean).join(" ").toLowerCase();
  return excludedTerms.find((term) => haystack.includes(term)) || null;
}

function identityPoints(record) {
  if (record.upc) return { points: 25, basis: "GTIN/UPC" };
  if (record.mpn && record.brand) return { points: 23, basis: "brand + MPN" };
  if (record.mpn) return { points: 17, basis: "MPN" };
  if (record.sourceSku) return { points: 10, basis: "supplier SKU only" };
  return { points: 0, basis: "title only" };
}

function confirmedMoq(record) {
  return ["CONFIRMED", "SUPPLIER_CONFIRMED", "EXPLICIT"].includes(String(record.moqEvidence || "").toUpperCase());
}

function supportedMoq(record) {
  return confirmedMoq(record) || ["SUPPORTED", "SUPPLIER_SUPPORTED"].includes(String(record.moqEvidence || "").toUpperCase());
}

export function evidenceConfidence(record) {
  let score = 0;
  const warnings = [];
  const identity = identityPoints(record);
  if (record.upc) score += 35;
  else if (record.mpn && record.brand) score += 32;
  else if (record.mpn) score += 24;
  else if (record.sourceSku) { score += 15; warnings.push("identity relies on supplier SKU"); }
  else warnings.push("identity is title-only");

  if (record.weightOz) score += 15; else warnings.push("unit weight missing");
  const dimensionCount = [record.lengthIn, record.widthIn, record.heightIn].filter((value) => value !== null && value !== undefined).length;
  if (dimensionCount === 3) score += 10;
  else if (dimensionCount > 0) { score += 4; warnings.push("item dimensions incomplete"); }
  else warnings.push("item dimensions missing");

  if (record.availableQuantity !== null && record.availableQuantity !== undefined) score += 10;
  else warnings.push("inventory quantity missing");

  if (confirmedMoq(record)) score += 10;
  else if (supportedMoq(record)) { score += 8; warnings.push("MOQ supported by supplier flag; confirm ordering policy before BUY"); }
  else { score += 2; warnings.push("MOQ evidence not explicit"); }

  const provenance = record.provenance || {};
  if (provenance.rightsEvidenceRef && provenance.fileName && Number.isSafeInteger(provenance.rowNumber)) score += 15;
  else if (provenance.fileName || provenance.rightsEvidenceRef) { score += 8; warnings.push("source provenance incomplete"); }
  else warnings.push("source provenance missing");

  if (record.sourceUrl) score += 5;
  else warnings.push("no direct supplier product URL; uploaded-row provenance retained");

  const retail = record.supplierSignals?.retailPriceCents;
  if (Number.isSafeInteger(retail) && retail >= 0) score += 5;
  else warnings.push("supplier retail-price reference missing");

  return { score: Math.min(100, score), warnings, identityBasis: identity.basis };
}

function retailSpreadPoints(record) {
  const retail = record.supplierSignals?.retailPriceCents;
  if (!Number.isSafeInteger(retail) || retail <= 0) return { points: 4, grossSpreadCents: null, ratio: null, warning: "supplier retail-price proxy unavailable" };
  const grossSpreadCents = retail - record.unitCostCents;
  if (grossSpreadCents <= 0) return { points: 0, grossSpreadCents, ratio: retail / Math.max(1, record.unitCostCents), warning: "supplier retail price does not exceed source cost" };
  const ratio = retail / Math.max(1, record.unitCostCents);
  let points = 0;
  if (grossSpreadCents >= 2500 && ratio >= 1.75) points = 30;
  else if (grossSpreadCents >= 1500 && ratio >= 1.5) points = 25;
  else if (grossSpreadCents >= 800 && ratio >= 1.4) points = 19;
  else if (grossSpreadCents >= 400 && ratio >= 1.25) points = 12;
  else if (grossSpreadCents >= 200) points = 7;
  else points = 3;
  return { points, grossSpreadCents, ratio, warning: points <= 7 ? "thin supplier retail spread" : null };
}

function availabilityPoints(record) {
  if (record.availableQuantity === null || record.availableQuantity === undefined) return { points: 2, warning: "inventory quantity unavailable" };
  if (record.availableQuantity < record.moq) return { points: 0, warning: "inventory below MOQ" };
  if (record.availableQuantity >= Math.max(50, record.moq * 10)) return { points: 15, warning: null };
  if (record.availableQuantity >= Math.max(10, record.moq * 3)) return { points: 11, warning: null };
  return { points: 6, warning: "limited inventory depth" };
}

function shippingPoints(record) {
  let points = 0;
  const warnings = [];
  if (record.weightOz) {
    if (record.weightOz <= 16) points += 10;
    else if (record.weightOz <= 32) points += 8;
    else if (record.weightOz <= 80) points += 5;
    else points += 2;
  } else warnings.push("unit weight missing");
  const dimensionCount = [record.lengthIn, record.widthIn, record.heightIn].filter((value) => value !== null && value !== undefined).length;
  if (dimensionCount === 3) points += 5;
  else if (dimensionCount > 0) { points += 2; warnings.push("item dimensions incomplete"); }
  else warnings.push("item dimensions missing");
  return { points, warnings };
}

function capitalPoints(record, policy) {
  const initialOutlayCents = record.unitCostCents * record.moq;
  const sourceRatio = record.unitCostCents / policy.maxSourceCostCents;
  const outlayRatio = initialOutlayCents / policy.maxInitialOutlayCents;
  const sourcePoints = sourceRatio <= 0.2 ? 4 : sourceRatio <= 0.5 ? 3 : sourceRatio <= 0.8 ? 2 : 1;
  const outlayPoints = outlayRatio <= 0.2 ? 6 : outlayRatio <= 0.5 ? 4 : outlayRatio <= 0.8 ? 2 : 1;
  return { points: sourcePoints + outlayPoints, initialOutlayCents };
}

function riskPoints(record) {
  const value = record.supplierSignals?.returnable;
  if (value === true) return { points: 5, warning: null };
  if (value === false) return { points: 0, warning: "supplier marks item non-returnable" };
  return { points: 2, warning: "supplier returnability unknown" };
}

export function scoreCandidateV2(record, policy) {
  const identity = identityPoints(record);
  const retail = retailSpreadPoints(record);
  const availability = availabilityPoints(record);
  const shipping = shippingPoints(record);
  const capital = capitalPoints(record, policy);
  const risk = riskPoints(record);
  const evidence = evidenceConfidence(record);
  const warnings = [retail.warning, availability.warning, ...shipping.warnings, risk.warning].filter(Boolean);
  if (!supportedMoq(record)) warnings.push("MOQ evidence not supplier-confirmed");
  const opportunityScore = Math.min(100, identity.points + retail.points + availability.points + shipping.points + capital.points + risk.points);
  return {
    score: opportunityScore,
    opportunityScore,
    evidenceConfidence: evidence.score,
    identityBasis: evidence.identityBasis,
    warnings: [...new Set(warnings)],
    evidenceWarnings: [...new Set(evidence.warnings)],
    initialOutlayCents: capital.initialOutlayCents,
    supplierRetailPriceCents: record.supplierSignals?.retailPriceCents ?? null,
    supplierGrossSpreadCents: retail.grossSpreadCents,
    supplierRetailMultiple: retail.ratio,
  };
}

function evaluateCandidateV2(record, policy) {
  if (!record || typeof record !== "object") return { disposition: "REJECT", reason: "record is invalid" };
  if (record.schemaVersion !== "1.0.0") return { disposition: "REJECT", reason: "unsupported intake schema" };
  if (record.eRetailingProhibited === true) return { disposition: "REJECT", reason: "supplier/mill prohibits e-retailing on marketplaces including eBay" };
  if (record.currency !== policy.currency) return { disposition: "REJECT", reason: `currency ${record.currency || "unknown"} is outside the USD MVP` };
  if (!Number.isSafeInteger(record.unitCostCents) || record.unitCostCents < 0) return { disposition: "REJECT", reason: "source cost is invalid" };
  if (!Number.isSafeInteger(record.moq) || record.moq < 1) return { disposition: "REJECT", reason: "MOQ is invalid" };
  if (record.unitCostCents > policy.maxSourceCostCents) return { disposition: "REJECT", reason: "source cost exceeds owner cap" };
  const initialOutlayCents = record.unitCostCents * record.moq;
  if (!Number.isSafeInteger(initialOutlayCents) || initialOutlayCents > policy.maxInitialOutlayCents) return { disposition: "REJECT", reason: "minimum-order outlay exceeds owner cap", initialOutlayCents };
  if (record.availableQuantity !== null && record.availableQuantity !== undefined && record.availableQuantity < record.moq) return { disposition: "REJECT", reason: "known available quantity is below MOQ", initialOutlayCents };
  const excludedTerm = containsExcludedTerm(record, policy.excludedTerms);
  if (excludedTerm) return { disposition: "REJECT", reason: `owner-excluded term matched: ${excludedTerm}`, initialOutlayCents };
  if (!record.upc && !record.mpn && !record.sourceSku) return { disposition: "REVIEW", reason: "identity is title-only; add GTIN/UPC, MPN, or supplier SKU before marketplace verification", initialOutlayCents };
  if (String(record.moqEvidence || "").toUpperCase() === "UNKNOWN") return { disposition: "REVIEW", reason: "MOQ evidence is unknown; verify supplier order quantity before marketplace research", initialOutlayCents };
  return { disposition: "ELIGIBLE", reason: "source-side constraints passed", ...scoreCandidateV2(record, policy) };
}

export function prescreenBrowserCandidates(records, policyInput = {}) {
  if (!Array.isArray(records)) throw new Error("records must be an array");
  const policy = validatePolicy(policyInput);
  const rejected = [];
  const review = [];
  const eligible = [];
  for (const record of records) {
    const evaluation = evaluateCandidateV2(record, policy);
    const entry = Object.freeze({
      candidateId: record?.candidateId || null,
      title: record?.title || null,
      supplier: record?.supplier || null,
      productIdentityKey: record?.productIdentityKey || null,
      unitCostCents: record?.unitCostCents ?? null,
      moq: record?.moq ?? null,
      ...evaluation,
      record,
    });
    if (evaluation.disposition === "REJECT") rejected.push(entry);
    else if (evaluation.disposition === "REVIEW") review.push(entry);
    else eligible.push(entry);
  }
  eligible.sort((a, b) => {
    if (b.opportunityScore !== a.opportunityScore) return b.opportunityScore - a.opportunityScore;
    if (b.evidenceConfidence !== a.evidenceConfidence) return b.evidenceConfidence - a.evidenceConfidence;
    if ((b.supplierGrossSpreadCents ?? -1) !== (a.supplierGrossSpreadCents ?? -1)) return (b.supplierGrossSpreadCents ?? -1) - (a.supplierGrossSpreadCents ?? -1);
    if (a.initialOutlayCents !== b.initialOutlayCents) return a.initialOutlayCents - b.initialOutlayCents;
    return String(a.candidateId).localeCompare(String(b.candidateId));
  });
  const verificationQueue = eligible.slice(0, policy.maxVerificationQueue).map((entry, index) => Object.freeze({
    ...entry,
    disposition: "VERIFY",
    verificationRank: index + 1,
    reason: "selected for human eBay verification; supplier-side score is research priority, not marketplace demand",
  }));
  const deferred = eligible.slice(policy.maxVerificationQueue).map((entry) => Object.freeze({ ...entry, disposition: "DEFER", reason: "eligible but outside the bounded marketplace-verification queue" }));
  return Object.freeze({
    schemaVersion: "2.0.0",
    prescreenVersion: PRESCREEN_VERSION,
    policy,
    inputCount: records.length,
    verificationCount: verificationQueue.length,
    deferredCount: deferred.length,
    reviewCount: review.length,
    rejectedCount: rejected.length,
    verificationQueue,
    deferred,
    review,
    rejected,
    externalActions: 0,
    marketplaceFetches: 0,
    machineFetches: 0,
    spendingCents: 0,
  });
}
