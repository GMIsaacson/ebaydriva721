export const WEB_GATE_VERSION = "datascout-web-gated-queue/1.0.0";
const ALLOWED_SURVIVOR_STATUSES = new Set(["PLAUSIBLE", "PRICE_RISK", "NO_EVIDENCE"]);

const orderedEligible = (prescreen) => {
  if (!prescreen || typeof prescreen !== "object") throw new Error("prescreen result is required");
  const first = Array.isArray(prescreen.verificationQueue) ? prescreen.verificationQueue : [];
  const rest = Array.isArray(prescreen.deferred) ? prescreen.deferred : [];
  return [...first, ...rest].map((entry) => ({
    ...entry,
    disposition: "PROVISIONAL_WEB_CHECK",
    verificationRank: undefined,
    reason: "source-side candidate awaiting public-web competitive-price gate",
  }));
};

export function buildBrowserProvisionalWebPool(prescreen, { poolSize = 150 } = {}) {
  if (!Number.isSafeInteger(poolSize) || poolSize < 1 || poolSize > 500) throw new Error("poolSize must be an integer from 1 to 500");
  const eligible = orderedEligible(prescreen);
  const exactIdentity = [];
  const identityReview = [];
  for (const entry of eligible) {
    if (entry.record?.upc || entry.record?.mpn) exactIdentity.push(entry);
    else identityReview.push({
      ...entry,
      disposition: "WEB_IDENTITY_REVIEW",
      reason: "GTIN/UPC or MPN is required before automated public-web exact-match checking",
    });
  }
  return {
    schemaVersion: "1.0.0",
    webGateVersion: WEB_GATE_VERSION,
    poolSize,
    provisionalPool: exactIdentity.slice(0, poolSize),
    outsidePool: exactIdentity.slice(poolSize),
    identityReview,
  };
}

const assessmentRank = (status) => status === "PLAUSIBLE" ? 3 : status === "NO_EVIDENCE" ? 2 : status === "PRICE_RISK" ? 1 : 0;

const compareSurvivors = (a, b) => {
  const statusDelta = assessmentRank(b.webAssessment.status) - assessmentRank(a.webAssessment.status);
  if (statusDelta) return statusDelta;
  if (b.opportunityScore !== a.opportunityScore) return b.opportunityScore - a.opportunityScore;
  if (b.evidenceConfidence !== a.evidenceConfidence) return b.evidenceConfidence - a.evidenceConfidence;
  const bCeiling = b.webAssessment.grossSpreadCeilingCents ?? -1;
  const aCeiling = a.webAssessment.grossSpreadCeilingCents ?? -1;
  if (bCeiling !== aCeiling) return bCeiling - aCeiling;
  if ((b.supplierGrossSpreadCents ?? -1) !== (a.supplierGrossSpreadCents ?? -1)) return (b.supplierGrossSpreadCents ?? -1) - (a.supplierGrossSpreadCents ?? -1);
  return String(a.candidateId).localeCompare(String(b.candidateId));
};

export function finalizeBrowserWebGatedQueue({ prescreen, assessments = {}, maxVerificationQueue, poolSize = 150 } = {}) {
  if (!assessments || typeof assessments !== "object" || Array.isArray(assessments)) throw new Error("assessments must be an object keyed by candidateId");
  const maxQueue = maxVerificationQueue ?? prescreen?.policy?.maxVerificationQueue ?? 50;
  if (!Number.isSafeInteger(maxQueue) || maxQueue < 1 || maxQueue > 100) throw new Error("maxVerificationQueue must be an integer from 1 to 100");

  const pool = buildBrowserProvisionalWebPool(prescreen, { poolSize });
  const survivors = [];
  const webDeferred = [];
  const pendingWebChecks = [];
  const invalidAssessments = [];

  for (const entry of pool.provisionalPool) {
    const assessment = assessments[entry.candidateId];
    if (!assessment) {
      pendingWebChecks.push({ ...entry, disposition: "WEB_PENDING", reason: "public-web competitive-price assessment has not run yet" });
      continue;
    }
    if (assessment.candidateId && assessment.candidateId !== entry.candidateId) {
      invalidAssessments.push({ ...entry, disposition: "WEB_REVIEW", reason: "public-web assessment candidate identity mismatch", webAssessment: assessment });
      continue;
    }
    if (assessment.action === "DEFER_WEB_PRICE" || assessment.status === "GROSS_PROFIT_IMPOSSIBLE") {
      webDeferred.push({ ...entry, disposition: "DEFER_WEB_PRICE", reason: assessment.reason || "public-web competitive price eliminated candidate", webAssessment: assessment });
      continue;
    }
    if (!ALLOWED_SURVIVOR_STATUSES.has(assessment.status)) {
      invalidAssessments.push({ ...entry, disposition: "WEB_REVIEW", reason: `unsupported public-web status: ${assessment.status || "unknown"}`, webAssessment: assessment });
      continue;
    }
    survivors.push({ ...entry, disposition: "WEB_SURVIVOR", reason: assessment.reason || "public-web gate did not eliminate candidate", webAssessment: assessment });
  }

  survivors.sort(compareSurvivors);
  const verificationQueue = survivors.slice(0, maxQueue).map((entry, index) => ({
    ...entry,
    disposition: "VERIFY",
    verificationRank: index + 1,
    reason: "passed source-side prescreen and public-web price gate; exact eBay sold demand still requires manual verification",
  }));
  const webSurvivorOverflow = survivors.slice(maxQueue).map((entry) => ({
    ...entry,
    disposition: "DEFER_WEB_SURVIVOR",
    reason: "survived public-web price gate but falls outside the bounded eBay verification queue",
  }));

  return {
    schemaVersion: "1.0.0",
    webGateVersion: WEB_GATE_VERSION,
    inputCount: prescreen?.inputCount ?? null,
    provisionalCount: pool.provisionalPool.length,
    checkedCount: pool.provisionalPool.length - pendingWebChecks.length,
    verificationCount: verificationQueue.length,
    webDeferredCount: webDeferred.length,
    pendingWebCount: pendingWebChecks.length,
    webReviewCount: pool.identityReview.length + invalidAssessments.length,
    outsidePoolCount: pool.outsidePool.length,
    verificationQueue,
    webDeferred,
    pendingWebChecks,
    webReview: [...pool.identityReview, ...invalidAssessments],
    webSurvivorOverflow,
    outsidePool: pool.outsidePool,
    complete: pendingWebChecks.length === 0,
    externalActions: 0,
    ebayAutomatedFetches: 0,
    purchases: 0,
    listings: 0,
  };
}
