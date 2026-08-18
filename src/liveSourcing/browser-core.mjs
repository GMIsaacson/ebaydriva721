import Papa from "papaparse";

export const BROWSER_CORE_VERSION = "datascout-browser-sourcing/1.0.0";
export const MAX_RECORDS_DEFAULT = 5000;

export const FIELD_ALIASES = Object.freeze({
  title: ["title", "name", "product", "productname", "product_title"],
  supplier: ["supplier", "vendor", "source", "sourcename", "suppliername"],
  sourceSku: ["sourcesku", "source_sku", "sku", "itemnumber", "item_number", "supplier_sku"],
  mpn: ["mpn", "manufacturerpartnumber", "manufacturer_part_number", "partnumber", "part_number"],
  upc: ["upc", "gtin", "barcode", "ean"],
  brand: ["brand", "manufacturer"],
  category: ["category", "department"],
  condition: ["condition", "itemcondition"],
  packQuantity: ["packquantity", "pack_quantity", "packqty", "pack_qty", "unitsperpack", "units_per_pack"],
  unitCost: ["unitcost", "unit_cost", "cost", "price", "sourcecost", "source_cost"],
  currency: ["currency", "currencycode", "currency_code"],
  moq: ["moq", "minimumorderquantity", "minimum_order_quantity", "minqty", "min_qty"],
  availableQuantity: ["availablequantity", "available_quantity", "stock", "inventory", "qtyavailable", "qty_available"],
  weightOz: ["weightoz", "weight_oz", "ounces", "shippingweightoz", "shipping_weight_oz"],
  weightLb: ["weightlb", "weight_lb", "pounds", "shippingweightlb", "shipping_weight_lb"],
  lengthIn: ["lengthin", "length_in", "length"],
  widthIn: ["widthin", "width_in", "width"],
  heightIn: ["heightin", "height_in", "height"],
  sourceUrl: ["sourceurl", "source_url", "buyurl", "buy_url", "url", "producturl", "product_url"],
});

export const DEFAULT_PRESCREEN_POLICY = Object.freeze({
  marketplace: "ebay-us",
  currency: "USD",
  maxVerificationQueue: 50,
  maxSourceCostCents: 10000,
  maxInitialOutlayCents: 50000,
  excludedTerms: [],
});

function canonicalKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim().replace(/\s+/g, " ");
  return text || null;
}

function buildLookup(row) {
  const lookup = new Map();
  Object.entries(row || {}).forEach(([key, value]) => lookup.set(canonicalKey(key), value));
  return lookup;
}

function pick(lookup, aliases) {
  for (const alias of aliases) {
    const key = canonicalKey(alias);
    if (lookup.has(key)) return lookup.get(key);
  }
  return undefined;
}

function parsePositiveInteger(value, fallback, field) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${field} must be a positive integer`);
  return parsed;
}

function parseOptionalNonNegativeInteger(value, field) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${field} must be a non-negative integer`);
  return parsed;
}

function parseOptionalPositiveNumber(value, field) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${field} must be a positive number`);
  return parsed;
}

function parseMoneyToCents(value) {
  if (value === undefined || value === null || String(value).trim() === "") throw new Error("unitCost is required");
  const cleaned = String(value).trim().replace(/[$,]/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("unitCost must be a non-negative number");
  const cents = Math.round(parsed * 100);
  if (!Number.isSafeInteger(cents)) throw new Error("unitCost is outside the supported range");
  return cents;
}

function normalizeUpc(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

function identityFor({ upc, mpn, brand, sourceSku, supplier, title }) {
  if (upc) return { key: `upc:${upc}`, confidence: "HIGH" };
  if (mpn && brand) return { key: `brand-mpn:${canonicalKey(brand)}:${canonicalKey(mpn)}`, confidence: "HIGH" };
  if (mpn) return { key: `mpn:${canonicalKey(mpn)}`, confidence: "MEDIUM" };
  if (sourceSku) return { key: `supplier-sku:${canonicalKey(supplier)}:${canonicalKey(sourceSku)}`, confidence: "MEDIUM" };
  return { key: `title:${canonicalKey(title)}`, confidence: "LOW" };
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hash(value, length = 20) {
  return (await sha256Hex(value)).slice(0, length);
}

function stableRecordFields(record) {
  return [
    record.title, record.supplier, record.sourceSku, record.mpn, record.upc, record.brand,
    record.category, record.condition, record.packQuantity, record.unitCostCents, record.currency,
    record.moq, record.availableQuantity, record.weightOz, record.lengthIn, record.widthIn,
    record.heightIn, record.sourceUrl,
  ];
}

async function stableRecordFingerprint(record) {
  return hash(JSON.stringify(stableRecordFields(record)), 32);
}

async function normalizeRow(row, rowNumber, context) {
  const lookup = buildLookup(row);
  const title = normalizeText(pick(lookup, FIELD_ALIASES.title));
  const supplier = normalizeText(pick(lookup, FIELD_ALIASES.supplier)) || normalizeText(context.defaultSupplier);
  if (!title) throw new Error("title is required");
  if (!supplier) throw new Error("supplier is required");

  const sourceSku = normalizeText(pick(lookup, FIELD_ALIASES.sourceSku));
  const mpn = normalizeText(pick(lookup, FIELD_ALIASES.mpn));
  const upc = normalizeUpc(pick(lookup, FIELD_ALIASES.upc));
  const brand = normalizeText(pick(lookup, FIELD_ALIASES.brand));
  const category = normalizeText(pick(lookup, FIELD_ALIASES.category));
  const condition = normalizeText(pick(lookup, FIELD_ALIASES.condition));
  const packQuantity = parsePositiveInteger(pick(lookup, FIELD_ALIASES.packQuantity), 1, "packQuantity");
  const unitCostCents = parseMoneyToCents(pick(lookup, FIELD_ALIASES.unitCost));
  const currency = (normalizeText(pick(lookup, FIELD_ALIASES.currency)) || context.defaultCurrency || "USD").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("currency must be a three-letter code");
  const moq = parsePositiveInteger(pick(lookup, FIELD_ALIASES.moq), 1, "moq");
  const availableQuantity = parseOptionalNonNegativeInteger(pick(lookup, FIELD_ALIASES.availableQuantity), "availableQuantity");

  let weightOz = parseOptionalPositiveNumber(pick(lookup, FIELD_ALIASES.weightOz), "weightOz");
  if (weightOz === null) {
    const weightLb = parseOptionalPositiveNumber(pick(lookup, FIELD_ALIASES.weightLb), "weightLb");
    if (weightLb !== null) weightOz = weightLb * 16;
  }

  const lengthIn = parseOptionalPositiveNumber(pick(lookup, FIELD_ALIASES.lengthIn), "lengthIn");
  const widthIn = parseOptionalPositiveNumber(pick(lookup, FIELD_ALIASES.widthIn), "widthIn");
  const heightIn = parseOptionalPositiveNumber(pick(lookup, FIELD_ALIASES.heightIn), "heightIn");
  const sourceUrl = normalizeText(pick(lookup, FIELD_ALIASES.sourceUrl));

  const identity = identityFor({ upc, mpn, brand, sourceSku, supplier, title });
  const offerKey = `${canonicalKey(supplier)}|${sourceSku ? canonicalKey(sourceSku) : identity.key}|pack:${packQuantity}`;
  const candidateId = `DSC-${await hash(`${offerKey}|${identity.key}`)}`;

  return {
    schemaVersion: "1.0.0",
    candidateId,
    productIdentityKey: identity.key,
    identityConfidence: identity.confidence,
    offerKey,
    title,
    supplier,
    sourceSku,
    mpn,
    upc,
    brand,
    category,
    condition,
    packQuantity,
    unitCostCents,
    currency,
    moq,
    availableQuantity,
    weightOz,
    lengthIn,
    widthIn,
    heightIn,
    sourceUrl,
    provenance: {
      accessSourceId: "owner-authorized-upload",
      accessMode: "owner_upload",
      rightsEvidenceRef: "owner-attestation://runtime",
      fileName: context.fileName,
      rowNumber,
      observedAt: context.observedAt,
      uploadedBy: context.uploadedBy,
    },
  };
}

function parseDataset(content, format) {
  if (typeof content !== "string") throw new Error("dataset content must be a UTF-8 string");
  if (format === "json") {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error("JSON dataset must be an array of records");
    return parsed;
  }
  if (format === "csv") {
    const parsed = Papa.parse(content, { header: true, skipEmptyLines: "greedy", transformHeader: (header) => String(header || "").trim() });
    if (parsed.errors?.length) throw new Error(`CSV parse failed: ${parsed.errors[0].message}`);
    return parsed.data;
  }
  throw new Error("format must be csv or json");
}

function resolveFormat(format, fileName) {
  const explicit = normalizeText(format)?.toLowerCase();
  if (explicit) return explicit;
  const match = String(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  if (match?.[1] === "csv") return "csv";
  if (match?.[1] === "json") return "json";
  throw new Error("format could not be determined; use CSV or JSON");
}

export async function ingestBrowserDataset({
  ownerAttestation = false,
  content,
  format,
  fileName = "uploaded-dataset",
  uploadedBy,
  observedAt = new Date().toISOString(),
  defaultSupplier = null,
  defaultCurrency = "USD",
  maxRecords = MAX_RECORDS_DEFAULT,
} = {}) {
  if (ownerAttestation !== true) throw new Error("Confirm that you are authorized to use this uploaded dataset before running the scan.");
  if (!uploadedBy || !String(uploadedBy).trim()) throw new Error("uploadedBy is required");
  if (!Number.isSafeInteger(maxRecords) || maxRecords < 1 || maxRecords > 25000) throw new Error("maxRecords must be an integer from 1 to 25000");
  if (!Number.isFinite(Date.parse(observedAt))) throw new Error("observedAt must be a valid ISO date-time");

  const resolvedFormat = resolveFormat(format, fileName);
  const rows = parseDataset(content, resolvedFormat);
  if (rows.length > maxRecords) throw new Error(`Dataset contains ${rows.length} records; maximum is ${maxRecords}.`);

  const context = { fileName, uploadedBy: String(uploadedBy).trim(), observedAt, defaultSupplier, defaultCurrency };
  const acceptedByKey = new Map();
  const conflictedKeys = new Set();
  const invalid = [];
  const reviews = [];
  let duplicateCount = 0;

  for (let index = 0; index < rows.length; index += 1) {
    let record;
    try {
      record = await normalizeRow(rows[index], index + 2, context);
    } catch (error) {
      invalid.push({ rowNumber: index + 2, reason: error.message });
      continue;
    }

    if (conflictedKeys.has(record.offerKey)) {
      reviews.push({ offerKey: record.offerKey, rowNumbers: [record.provenance.rowNumber], reason: "offer already has conflicting duplicate data" });
      continue;
    }

    const fingerprint = await stableRecordFingerprint(record);
    const previous = acceptedByKey.get(record.offerKey);
    if (!previous) {
      acceptedByKey.set(record.offerKey, { record, fingerprint });
      continue;
    }
    if (previous.fingerprint === fingerprint) {
      duplicateCount += 1;
      continue;
    }

    acceptedByKey.delete(record.offerKey);
    conflictedKeys.add(record.offerKey);
    reviews.push({
      offerKey: record.offerKey,
      rowNumbers: [previous.record.provenance.rowNumber, record.provenance.rowNumber],
      reason: "duplicate offer contains conflicting normalized data",
    });
  }

  const records = [...acceptedByKey.values()].map((entry) => entry.record);
  const datasetPieces = [];
  for (const record of records) datasetPieces.push([record.candidateId, await stableRecordFingerprint(record)]);
  const datasetHash = await hash(JSON.stringify(datasetPieces), 32);

  return {
    schemaVersion: "1.0.0",
    coreVersion: BROWSER_CORE_VERSION,
    status: invalid.length || reviews.length ? "REVIEW" : "ACCEPTED",
    fileName,
    format: resolvedFormat,
    inputCount: rows.length,
    acceptedCount: records.length,
    duplicateCount,
    invalidCount: invalid.length,
    reviewCount: reviews.length,
    records,
    invalid,
    reviews,
    datasetHash,
    sourceAccess: { sourceId: "owner-authorized-upload", classification: "GREEN", accessMode: "owner_upload", machineFetchAllowed: false },
    externalActions: 0,
    machineFetches: 0,
    spendingCents: 0,
  };
}

function validatePolicy(policyInput) {
  const policy = { ...DEFAULT_PRESCREEN_POLICY, ...(policyInput || {}) };
  if (policy.marketplace !== "ebay-us") throw new Error("marketplace must remain ebay-us for this MVP");
  if (policy.currency !== "USD") throw new Error("currency must remain USD for this MVP");
  if (!Number.isSafeInteger(policy.maxVerificationQueue) || policy.maxVerificationQueue < 1 || policy.maxVerificationQueue > 100) throw new Error("Verification queue must be 1 to 100.");
  if (!Number.isSafeInteger(policy.maxSourceCostCents) || policy.maxSourceCostCents < 1) throw new Error("Maximum source cost must be positive.");
  if (!Number.isSafeInteger(policy.maxInitialOutlayCents) || policy.maxInitialOutlayCents < 1) throw new Error("Maximum initial outlay must be positive.");
  if (!Array.isArray(policy.excludedTerms)) throw new Error("excludedTerms must be an array");
  return {
    ...policy,
    excludedTerms: policy.excludedTerms.map((term) => String(term).trim().toLowerCase()).filter(Boolean),
  };
}

function containsExcludedTerm(record, excludedTerms) {
  const haystack = [record.title, record.category, record.condition, record.brand].filter(Boolean).join(" ").toLowerCase();
  return excludedTerms.find((term) => haystack.includes(term)) || null;
}

function scoreCandidate(record, policy) {
  let score = 0;
  const warnings = [];
  if (record.identityConfidence === "HIGH") score += 35;
  else if (record.identityConfidence === "MEDIUM") score += 25;
  else warnings.push("low identity confidence");
  if (record.weightOz) score += 10; else warnings.push("weight missing");
  const dimensionCount = [record.lengthIn, record.widthIn, record.heightIn].filter((value) => value !== null && value !== undefined).length;
  if (dimensionCount === 3) score += 15;
  else if (dimensionCount > 0) { score += 5; warnings.push("dimensions incomplete"); }
  else warnings.push("dimensions missing");
  if (record.availableQuantity === null || record.availableQuantity === undefined) score += 5;
  else if (record.availableQuantity >= record.moq * 3) score += 15;
  else score += 10;
  score += Math.round(Math.max(0, 1 - (record.unitCostCents / policy.maxSourceCostCents)) * 20);
  const initialOutlayCents = record.unitCostCents * record.moq;
  score += Math.round(Math.max(0, 1 - (initialOutlayCents / policy.maxInitialOutlayCents)) * 10);
  if (record.sourceUrl) score += 5; else warnings.push("source URL missing");
  return { score: Math.min(100, score), warnings, initialOutlayCents };
}

function evaluateCandidate(record, policy) {
  if (record.schemaVersion !== "1.0.0") return { disposition: "REJECT", reason: "unsupported intake schema" };
  if (record.currency !== policy.currency) return { disposition: "REJECT", reason: `currency ${record.currency || "unknown"} is outside the USD MVP` };
  if (record.unitCostCents > policy.maxSourceCostCents) return { disposition: "REJECT", reason: "source cost exceeds owner cap" };
  const initialOutlayCents = record.unitCostCents * record.moq;
  if (initialOutlayCents > policy.maxInitialOutlayCents) return { disposition: "REJECT", reason: "minimum-order outlay exceeds owner cap", initialOutlayCents };
  if (record.availableQuantity !== null && record.availableQuantity !== undefined && record.availableQuantity < record.moq) return { disposition: "REJECT", reason: "known available quantity is below MOQ", initialOutlayCents };
  const excludedTerm = containsExcludedTerm(record, policy.excludedTerms);
  if (excludedTerm) return { disposition: "REJECT", reason: `owner-excluded term matched: ${excludedTerm}`, initialOutlayCents };
  if (record.identityConfidence === "LOW") return { disposition: "REVIEW", reason: "identity is title-only; add UPC, MPN, or supplier SKU before marketplace verification", initialOutlayCents };
  return { disposition: "ELIGIBLE", reason: "source-side constraints passed", ...scoreCandidate(record, policy) };
}

export function prescreenBrowserCandidates(records, policyInput = {}) {
  if (!Array.isArray(records)) throw new Error("records must be an array");
  const policy = validatePolicy(policyInput);
  const rejected = [];
  const review = [];
  const eligible = [];

  records.forEach((record) => {
    const evaluation = evaluateCandidate(record, policy);
    const entry = { candidateId: record.candidateId, title: record.title, supplier: record.supplier, productIdentityKey: record.productIdentityKey, unitCostCents: record.unitCostCents, moq: record.moq, ...evaluation, record };
    if (evaluation.disposition === "REJECT") rejected.push(entry);
    else if (evaluation.disposition === "REVIEW") review.push(entry);
    else eligible.push(entry);
  });

  eligible.sort((a, b) => b.score - a.score || a.initialOutlayCents - b.initialOutlayCents || String(a.candidateId).localeCompare(String(b.candidateId)));
  const verificationQueue = eligible.slice(0, policy.maxVerificationQueue).map((entry, index) => ({ ...entry, disposition: "VERIFY", verificationRank: index + 1, reason: "selected for human eBay verification; marketplace demand is not yet known" }));
  const deferred = eligible.slice(policy.maxVerificationQueue).map((entry) => ({ ...entry, disposition: "DEFER", reason: "eligible but outside the bounded marketplace-verification queue" }));

  return {
    schemaVersion: "1.0.0",
    coreVersion: BROWSER_CORE_VERSION,
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
  };
}
