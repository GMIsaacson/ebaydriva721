export const LOCAL_ARBITRAGE_POLICY = Object.freeze({
  minNetProfitCents: 5000,
  minRoiPct: 40,
  minDensityPct: 3,
  maxEvidenceAgeHours: 168,
});

const asFinite = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function isPlausibleSourceListingUrl(input) {
  const value = String(input?.listingUrl || '').trim();
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === '/') return false;
    if (host.endsWith('craigslist.org')) return /\/\d+\.html$/i.test(path);
    if (host.endsWith('facebook.com')) return /\/marketplace\/item\/\d+/i.test(path);
    if (host.endsWith('offerup.com')) return /\/(item|items)\//i.test(path) || /\/item\/detail\//i.test(path);
    return false;
  } catch {
    return false;
  }
}

export function hasExactSourceListingUrl(input) {
  return input?.sourceListingUrlVerified === true && isPlausibleSourceListingUrl(input);
}

export function calculateLocalDealEconomics(input, policy = LOCAL_ARBITRAGE_POLICY) {
  const askPriceCents = Math.round(asFinite(input.askPriceCents));
  const expectedSaleCents = Math.round(asFinite(input.expectedSaleCents));
  const sellingFeesCents = Math.round(asFinite(input.sellingFeesCents));
  const shippingCents = Math.round(asFinite(input.shippingCents));
  const pickupCents = Math.round(asFinite(input.pickupCents));
  const packagingCents = Math.round(asFinite(input.packagingCents));
  const refurbishmentCents = Math.round(asFinite(input.refurbishmentCents));
  const riskReserveCents = Math.round(asFinite(input.riskReserveCents));

  const nonAcquisitionCostsCents = sellingFeesCents + shippingCents + pickupCents + packagingCents + refurbishmentCents + riskReserveCents;
  const expectedNetProfitCents = expectedSaleCents - askPriceCents - nonAcquisitionCostsCents;
  const totalCapitalCents = askPriceCents + pickupCents + refurbishmentCents;
  const roiPct = totalCapitalCents > 0 ? (expectedNetProfitCents / totalCapitalCents) * 100 : 0;
  const maxBuyPriceCents = Math.max(0, Math.floor((expectedSaleCents - nonAcquisitionCostsCents) / (1 + policy.minRoiPct / 100)));

  return {
    askPriceCents,
    expectedSaleCents,
    nonAcquisitionCostsCents,
    expectedNetProfitCents,
    roiPct: Number(roiPct.toFixed(1)),
    maxBuyPriceCents,
  };
}

export function scoreLocalListing(input, policy = LOCAL_ARBITRAGE_POLICY) {
  const economics = calculateLocalDealEconomics(input, policy);
  const economicsReady = input.economicsReady !== false && economics.expectedSaleCents > 0;
  const nowMs = Date.parse(input.now || new Date().toISOString());
  const observedMs = Date.parse(input.evidenceObservedAt || '');
  const evidenceAgeHours = Number.isFinite(nowMs) && Number.isFinite(observedMs)
    ? Math.max(0, (nowMs - observedMs) / 3600000)
    : Infinity;

  const exactIdentity = Boolean(input.exactIdentity || input.exactSku);
  const sourceListingVerified = hasExactSourceListingUrl(input) || Boolean(input.sourceSnapshotCaptured);
  const soldCompCount = Math.max(0, Math.floor(asFinite(input.soldCompCount)));
  const ambiguousCondition = Boolean(input.ambiguousCondition);
  const unresolvedItems = Math.max(0, Math.floor(asFinite(input.unresolvedItems)));
  const duplicate = Boolean(input.duplicate);
  const stale = Boolean(input.stale) || evidenceAgeHours > policy.maxEvidenceAgeHours;

  const reasons = [];
  let decision = 'WATCH';

  if (duplicate) reasons.push('duplicate listing/evidence');
  if (stale) reasons.push('stale evidence');
  if (!sourceListingVerified) reasons.push('source listing not live-verified or snapshot missing');
  if (!exactIdentity) reasons.push('identity not exact');
  if (soldCompCount < 1) reasons.push('no verified sold comp');
  if (!economicsReady) reasons.push('economics not verified');
  if (ambiguousCondition) reasons.push('condition requires human verification');
  if (unresolvedItems > 0) reasons.push(`${unresolvedItems} unresolved bundle item${unresolvedItems === 1 ? '' : 's'}`);

  const thresholdPass = economicsReady && economics.expectedNetProfitCents >= policy.minNetProfitCents && economics.roiPct >= policy.minRoiPct;
  const evidencePass = sourceListingVerified && exactIdentity && soldCompCount >= 1 && !stale && !duplicate && !ambiguousCondition && unresolvedItems === 0;

  if (economicsReady && !thresholdPass) {
    decision = 'REJECT';
    if (economics.expectedNetProfitCents < policy.minNetProfitCents) reasons.push('net profit below $50 threshold');
    if (economics.roiPct < policy.minRoiPct) reasons.push('ROI below 40% threshold');
  } else if (thresholdPass && evidencePass) {
    decision = 'BUY_CANDIDATE';
    reasons.push('passes economics and evidence gates; owner review required');
  }

  const economicsScore = economicsReady ? clamp(Math.round((economics.expectedNetProfitCents / Math.max(policy.minNetProfitCents, 1)) * 35), 0, 45) : 0;
  const roiScore = economicsReady ? clamp(Math.round((economics.roiPct / Math.max(policy.minRoiPct, 1)) * 25), 0, 30) : 0;
  const evidenceScore = (sourceListingVerified ? 5 : 0) + (exactIdentity ? 10 : 0) + Math.min(10, soldCompCount * 2) + (!stale && !duplicate ? 5 : 0);
  const dealScore = clamp(economicsScore + roiScore + evidenceScore, 0, 100);

  return {
    id: input.id,
    title: input.title,
    source: input.source,
    location: input.location,
    decision,
    reasons,
    dealScore,
    evidenceAgeHours: Number.isFinite(evidenceAgeHours) ? Number(evidenceAgeHours.toFixed(1)) : null,
    soldCompCount,
    exactIdentity,
    sourceListingVerified,
    sourceVerificationStatus: sourceListingVerified ? (input.sourceSnapshotCaptured ? 'SNAPSHOT_CAPTURED' : 'HTTP_VERIFIED') : (input.sourceVerificationStatus || 'DISCOVERED_UNVERIFIED'),
    economicsReady,
    economics,
    externalActions: 0,
    purchaseAuthorized: false,
    sellerMessagingAuthorized: false,
  };
}

export function buildLocalArbitrageQueue(listings, policy = LOCAL_ARBITRAGE_POLICY) {
  const scored = listings.map((listing) => scoreLocalListing(listing, policy));
  const uniqueScreened = scored.filter((item) => !item.reasons.includes('duplicate listing/evidence'));
  const actionable = uniqueScreened.filter((item) => item.decision === 'BUY_CANDIDATE');
  const densityPct = uniqueScreened.length ? (actionable.length / uniqueScreened.length) * 100 : 0;
  const verifiedScreens = uniqueScreened.filter((item) => item.economicsReady && item.sourceListingVerified && item.soldCompCount >= 1);
  const laneVerdict = verifiedScreens.length >= 20 && densityPct < policy.minDensityPct ? 'KILL_OR_REDESIGN' : 'CONTINUE_TESTING';

  return {
    policy,
    screenedCount: uniqueScreened.length,
    actionableCount: actionable.length,
    watchCount: uniqueScreened.filter((item) => item.decision === 'WATCH').length,
    rejectedCount: uniqueScreened.filter((item) => item.decision === 'REJECT').length,
    densityPct: Number(densityPct.toFixed(1)),
    laneVerdict,
    ranked: [...uniqueScreened].sort((a, b) => b.dealScore - a.dealScore || b.economics.expectedNetProfitCents - a.economics.expectedNetProfitCents),
    externalActions: 0,
  };
}
