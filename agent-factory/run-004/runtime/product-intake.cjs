'use strict';

const crypto = require('node:crypto');
const Papa = require('papaparse');
const { assertSourceAccess } = require('./source-access.cjs');

const MAX_RECORDS_DEFAULT = 5000;
const SCHEMA_VERSION = '1.0.0';

const FIELD_ALIASES = Object.freeze({
  title: ['title', 'name', 'product', 'productname', 'product_title'],
  supplier: ['supplier', 'vendor', 'source', 'sourcename', 'suppliername'],
  sourceSku: ['sourcesku', 'source_sku', 'sku', 'itemnumber', 'item_number', 'supplier_sku'],
  mpn: ['mpn', 'manufacturerpartnumber', 'manufacturer_part_number', 'partnumber', 'part_number'],
  upc: ['upc', 'gtin', 'barcode', 'ean'],
  brand: ['brand', 'manufacturer'],
  category: ['category', 'department'],
  condition: ['condition', 'itemcondition'],
  packQuantity: ['packquantity', 'pack_quantity', 'packqty', 'pack_qty', 'unitsperpack', 'units_per_pack'],
  unitCost: ['unitcost', 'unit_cost', 'cost', 'price', 'sourcecost', 'source_cost'],
  currency: ['currency', 'currencycode', 'currency_code'],
  moq: ['moq', 'minimumorderquantity', 'minimum_order_quantity', 'minqty', 'min_qty'],
  availableQuantity: ['availablequantity', 'available_quantity', 'stock', 'inventory', 'qtyavailable', 'qty_available'],
  weightOz: ['weightoz', 'weight_oz', 'ounces', 'shippingweightoz', 'shipping_weight_oz'],
  weightLb: ['weightlb', 'weight_lb', 'pounds', 'shippingweightlb', 'shipping_weight_lb'],
  lengthIn: ['lengthin', 'length_in', 'length'],
  widthIn: ['widthin', 'width_in', 'width'],
  heightIn: ['heightin', 'height_in', 'height'],
  sourceUrl: ['sourceurl', 'source_url', 'buyurl', 'buy_url', 'url', 'producturl', 'product_url'],
});

function canonicalKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim().replace(/\s+/g, ' ');
  return text || null;
}

function buildLookup(row) {
  const lookup = new Map();
  for (const [key, value] of Object.entries(row || {})) lookup.set(canonicalKey(key), value);
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
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${field} must be a positive integer`);
  return parsed;
}

function parseOptionalNonNegativeInteger(value, field) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${field} must be a non-negative integer`);
  return parsed;
}

function parseOptionalPositiveNumber(value, field) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${field} must be a positive number`);
  return parsed;
}

function parseMoneyToCents(value) {
  if (value === undefined || value === null || String(value).trim() === '') throw new Error('unitCost is required');
  const cleaned = String(value).trim().replace(/[$,]/g, '');
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('unitCost must be a non-negative number');
  const cents = Math.round(parsed * 100);
  if (!Number.isSafeInteger(cents)) throw new Error('unitCost is outside the supported range');
  return cents;
}

function normalizeUpc(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const digits = text.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

function identityFor({ upc, mpn, brand, sourceSku, supplier, title }) {
  if (upc) return { key: `upc:${upc}`, confidence: 'HIGH' };
  if (mpn && brand) return { key: `brand-mpn:${canonicalKey(brand)}:${canonicalKey(mpn)}`, confidence: 'HIGH' };
  if (mpn) return { key: `mpn:${canonicalKey(mpn)}`, confidence: 'MEDIUM' };
  if (sourceSku) return { key: `supplier-sku:${canonicalKey(supplier)}:${canonicalKey(sourceSku)}`, confidence: 'MEDIUM' };
  return { key: `title:${canonicalKey(title)}`, confidence: 'LOW' };
}

function hash(value, length = 20) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, length);
}

function stableRecordFingerprint(record) {
  const fields = [
    record.title, record.supplier, record.sourceSku, record.mpn, record.upc, record.brand,
    record.category, record.condition, record.packQuantity, record.unitCostCents, record.currency,
    record.moq, record.availableQuantity, record.weightOz, record.lengthIn, record.widthIn,
    record.heightIn, record.sourceUrl,
  ];
  return hash(JSON.stringify(fields), 32);
}

function normalizeRow(row, rowNumber, context) {
  const lookup = buildLookup(row);
  const title = normalizeText(pick(lookup, FIELD_ALIASES.title));
  const supplier = normalizeText(pick(lookup, FIELD_ALIASES.supplier)) || normalizeText(context.defaultSupplier);
  if (!title) throw new Error('title is required');
  if (!supplier) throw new Error('supplier is required');

  const sourceSku = normalizeText(pick(lookup, FIELD_ALIASES.sourceSku));
  const mpn = normalizeText(pick(lookup, FIELD_ALIASES.mpn));
  const upc = normalizeUpc(pick(lookup, FIELD_ALIASES.upc));
  const brand = normalizeText(pick(lookup, FIELD_ALIASES.brand));
  const category = normalizeText(pick(lookup, FIELD_ALIASES.category));
  const condition = normalizeText(pick(lookup, FIELD_ALIASES.condition));
  const packQuantity = parsePositiveInteger(pick(lookup, FIELD_ALIASES.packQuantity), 1, 'packQuantity');
  const unitCostCents = parseMoneyToCents(pick(lookup, FIELD_ALIASES.unitCost));
  const currency = (normalizeText(pick(lookup, FIELD_ALIASES.currency)) || context.defaultCurrency || 'USD').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('currency must be a three-letter code');
  const moq = parsePositiveInteger(pick(lookup, FIELD_ALIASES.moq), 1, 'moq');
  const availableQuantity = parseOptionalNonNegativeInteger(pick(lookup, FIELD_ALIASES.availableQuantity), 'availableQuantity');

  let weightOz = parseOptionalPositiveNumber(pick(lookup, FIELD_ALIASES.weightOz), 'weightOz');
  if (weightOz === null) {
    const weightLb = parseOptionalPositiveNumber(pick(lookup, FIELD_ALIASES.weightLb), 'weightLb');
    if (weightLb !== null) weightOz = weightLb * 16;
  }

  const lengthIn = parseOptionalPositiveNumber(pick(lookup, FIELD_ALIASES.lengthIn), 'lengthIn');
  const widthIn = parseOptionalPositiveNumber(pick(lookup, FIELD_ALIASES.widthIn), 'widthIn');
  const heightIn = parseOptionalPositiveNumber(pick(lookup, FIELD_ALIASES.heightIn), 'heightIn');
  const sourceUrl = normalizeText(pick(lookup, FIELD_ALIASES.sourceUrl));

  const identity = identityFor({ upc, mpn, brand, sourceSku, supplier, title });
  const offerKey = `${canonicalKey(supplier)}|${sourceSku ? canonicalKey(sourceSku) : identity.key}|pack:${packQuantity}`;
  const candidateId = `DSC-${hash(`${offerKey}|${identity.key}`)}`;

  return {
    schemaVersion: SCHEMA_VERSION,
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
      accessSourceId: context.sourceId,
      accessMode: context.accessMode,
      rightsEvidenceRef: context.accessDecision.rightsEvidenceRef,
      fileName: context.fileName,
      rowNumber,
      observedAt: context.observedAt,
      uploadedBy: context.uploadedBy,
    },
  };
}

function parseDataset(content, format) {
  if (typeof content !== 'string') throw new Error('dataset content must be a UTF-8 string');
  if (format === 'json') {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error('JSON dataset must be an array of records');
    return parsed;
  }
  if (format === 'csv') {
    const parsed = Papa.parse(content, { header: true, skipEmptyLines: 'greedy', transformHeader: (header) => String(header || '').trim() });
    if (parsed.errors?.length) throw new Error(`CSV parse failed: ${parsed.errors[0].message}`);
    return parsed.data;
  }
  throw new Error('format must be csv or json');
}

function resolveFormat(format, fileName) {
  const explicit = normalizeText(format)?.toLowerCase();
  if (explicit) return explicit;
  const match = String(fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  if (match?.[1] === 'csv') return 'csv';
  if (match?.[1] === 'json') return 'json';
  throw new Error('format could not be determined; use csv or json');
}

function ingestAuthorizedDataset({
  registry,
  sourceId = 'owner-authorized-upload',
  accessMode = 'owner_upload',
  ownerAttestation = false,
  content,
  format,
  fileName = 'uploaded-dataset',
  uploadedBy,
  observedAt = new Date().toISOString(),
  defaultSupplier = null,
  defaultCurrency = 'USD',
  maxRecords = MAX_RECORDS_DEFAULT,
} = {}) {
  if (ownerAttestation !== true) {
    const error = new Error('owner attestation is required before analyzing an uploaded dataset');
    error.code = 'OWNER_ATTESTATION_REQUIRED';
    throw error;
  }
  if (!uploadedBy || !String(uploadedBy).trim()) throw new Error('uploadedBy is required');
  if (!Number.isSafeInteger(maxRecords) || maxRecords < 1 || maxRecords > 25000) throw new Error('maxRecords must be an integer from 1 to 25000');
  if (!Number.isFinite(Date.parse(observedAt))) throw new Error('observedAt must be a valid ISO date-time');

  const accessDecision = assertSourceAccess({ registry, sourceId, accessMode, automated: false, at: observedAt });
  if (accessMode !== 'owner_upload') throw new Error('dataset intake currently accepts owner_upload only');

  const resolvedFormat = resolveFormat(format, fileName);
  const rows = parseDataset(content, resolvedFormat);
  if (rows.length > maxRecords) {
    const error = new Error(`dataset contains ${rows.length} records; maximum is ${maxRecords}`);
    error.code = 'DATASET_RECORD_CAP_EXCEEDED';
    throw error;
  }

  const context = { sourceId, accessMode, accessDecision, fileName, uploadedBy: String(uploadedBy).trim(), observedAt, defaultSupplier, defaultCurrency };
  const acceptedByKey = new Map();
  const conflictedKeys = new Set();
  const invalid = [];
  const reviews = [];
  let duplicateCount = 0;

  for (let index = 0; index < rows.length; index += 1) {
    let record;
    try {
      record = normalizeRow(rows[index], index + 2, context);
    } catch (error) {
      invalid.push({ rowNumber: index + 2, reason: error.message });
      continue;
    }

    if (conflictedKeys.has(record.offerKey)) {
      reviews.push({ offerKey: record.offerKey, rowNumbers: [record.provenance.rowNumber], reason: 'offer already has conflicting duplicate data' });
      continue;
    }

    const fingerprint = stableRecordFingerprint(record);
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
      reason: 'duplicate offer contains conflicting normalized data',
    });
  }

  const records = [...acceptedByKey.values()].map((entry) => entry.record);
  const datasetHash = hash(JSON.stringify(records.map((record) => [record.candidateId, stableRecordFingerprint(record)])), 32);

  return Object.freeze({
    schemaVersion: '1.0.0',
    status: invalid.length || reviews.length ? 'REVIEW' : 'ACCEPTED',
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
    sourceAccess: accessDecision,
    externalActions: 0,
    machineFetches: 0,
    spendingCents: 0,
  });
}

module.exports = {
  FIELD_ALIASES,
  MAX_RECORDS_DEFAULT,
  SCHEMA_VERSION,
  ingestAuthorizedDataset,
  normalizeRow,
  parseDataset,
  stableRecordFingerprint,
};
