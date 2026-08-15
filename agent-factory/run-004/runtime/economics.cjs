const { createHash } = require('node:crypto');

const FORMULA_VERSION = 'datascout-landed-economics/1.0.0';
const REQUIRED_FIELDS = Object.freeze([
  'collectedRevenueCents',
  'sourceCostCents',
  'inboundFreightCents',
  'marketplaceFeesCents',
  'outboundShippingCents',
  'packagingCents',
  'riskReserveCents',
]);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  return value;
}

function hashInput(input) {
  return createHash('sha256').update(JSON.stringify(canonicalize(input))).digest('hex');
}

function validateMoneyInput(input) {
  const missing = REQUIRED_FIELDS.filter((field) => input[field] === undefined || input[field] === null);
  const invalid = REQUIRED_FIELDS.filter(
    (field) => input[field] !== undefined && (!Number.isSafeInteger(input[field]) || input[field] < 0),
  );
  if (Number.isSafeInteger(input.collectedRevenueCents) && input.collectedRevenueCents <= 0) {
    invalid.push('collectedRevenueCents');
  }
  return { missing: [...new Set(missing)], invalid: [...new Set(invalid)] };
}

function calculateEconomics(input) {
  const normalized = Object.fromEntries(REQUIRED_FIELDS.map((field) => [field, input[field]]));
  const { missing, invalid } = validateMoneyInput(normalized);
  const inputHash = hashInput(normalized);

  if (missing.length || invalid.length) {
    return {
      status: 'Incomplete',
      formulaVersion: FORMULA_VERSION,
      inputHash,
      missing,
      invalid,
    };
  }

  const totalCostCents =
    normalized.sourceCostCents +
    normalized.inboundFreightCents +
    normalized.marketplaceFeesCents +
    normalized.outboundShippingCents +
    normalized.packagingCents +
    normalized.riskReserveCents;
  const netProfitCents = normalized.collectedRevenueCents - totalCostCents;

  return {
    status: 'Complete',
    formulaVersion: FORMULA_VERSION,
    inputHash,
    collectedRevenueCents: normalized.collectedRevenueCents,
    totalCostCents,
    netProfitCents,
    marginBps: Math.round((netProfitCents / normalized.collectedRevenueCents) * 10_000),
    roiBps: totalCostCents === 0 ? null : Math.round((netProfitCents / totalCostCents) * 10_000),
    breakEvenCollectedRevenueCents: totalCostCents,
  };
}

module.exports = {
  FORMULA_VERSION,
  REQUIRED_FIELDS,
  calculateEconomics,
  canonicalize,
  hashInput,
};
