import Papa from "papaparse";

const canonicalKey = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

function lookupRow(row) {
  const map = new Map();
  Object.entries(row || {}).forEach(([key, value]) => map.set(canonicalKey(key), value));
  return map;
}

function get(map, ...keys) {
  for (const key of keys) {
    const canonical = canonicalKey(key);
    if (map.has(canonical)) return map.get(canonical);
  }
  return undefined;
}

function text(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function boolean(value) {
  if (value === true || value === false) return value;
  const normalized = text(value).toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return null;
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function moneyCents(value) {
  if (value === undefined || value === null || text(value) === "") return null;
  const parsed = Number(String(value).replace(/[$,]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

function resolveFormat(fileName, explicitFormat) {
  if (explicitFormat) return String(explicitFormat).toLowerCase();
  const extension = String(fileName || "").toLowerCase().split(".").pop();
  if (["csv", "json"].includes(extension)) return extension;
  throw new Error("S&S adapter supports CSV or JSON input.");
}

function parse(content, format) {
  if (format === "json") {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error("JSON dataset must be an array.");
    return parsed;
  }
  const result = Papa.parse(content, { header: true, skipEmptyLines: "greedy", transformHeader: (header) => String(header || "").trim() });
  if (result.errors?.length) throw new Error(`CSV parse failed: ${result.errors[0].message}`);
  return result.data;
}

function looksLikeSsActivewear(row) {
  const map = lookupRow(row);
  const signatures = ["sku", "gtin", "brandname", "stylename", "customerprice", "noeretailing"].filter((key) => map.has(key));
  return signatures.length >= 4 && map.has("sku") && map.has("noeretailing");
}

/**
 * Converts supplier-provided S&S Product/Data Library rows into DataScout's generic
 * upload shape. It fails closed on the supplier's NoeRetailing field:
 * - true  => excluded from the eBay research queue
 * - false => not blocked by this supplier flag; continue through other controls
 * - absent/unparseable => REVIEW, not eligible
 *
 * Supplier retail/MAP values are retained only as source-side research-priority
 * signals. They are never substituted for observed eBay sold prices.
 *
 * S&S documents fullCaseOnly=true as requiring full-case quantities. When false,
 * DataScout records MOQ 1 as SUPPLIER_SUPPORTED rather than fully confirmed, so the
 * ordering policy remains visible before any final BUY decision.
 */
export function adaptSsActivewearDataset({ content, fileName, format, defaultSupplier = "S&S Activewear" } = {}) {
  if (typeof content !== "string") throw new Error("dataset content is required");
  const resolvedFormat = resolveFormat(fileName, format);
  const rows = parse(content, resolvedFormat);
  if (!rows.length || !looksLikeSsActivewear(rows[0])) {
    return {
      detected: false,
      format: resolvedFormat,
      content,
      inputCount: rows.length,
      allowedCount: rows.length,
      prohibitedCount: 0,
      reviewCount: 0,
      prohibited: [],
      review: [],
      metadataBySku: {},
    };
  }

  const allowed = [];
  const prohibited = [];
  const review = [];
  const metadataBySku = {};

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const map = lookupRow(row);
    const sourceSku = text(get(map, "sku"));
    const restriction = boolean(get(map, "NoeRetailing", "noeRetailing"));

    if (restriction === null) {
      review.push({ rowNumber, sourceSku: sourceSku || null, reason: "S&S NoeRetailing flag is missing or unparseable" });
      return;
    }
    if (restriction === true) {
      prohibited.push({ rowNumber, sourceSku: sourceSku || null, reason: "S&S/mill prohibits e-retailing on platforms including eBay" });
      return;
    }

    const brand = text(get(map, "brandName", "brand"));
    const styleName = text(get(map, "styleName", "style"));
    const colorName = text(get(map, "colorName"));
    const sizeName = text(get(map, "sizeName"));
    const title = [brand, styleName, colorName, sizeName].filter(Boolean).join(" ") || text(get(map, "title", "name"));
    const customerPrice = get(map, "customerPrice", "customer_price", "salePrice", "sale_price", "piecePrice", "piece_price");
    const caseQty = positiveInteger(get(map, "CaseQty", "caseQty", "case_qty"));
    const fullCaseOnly = boolean(get(map, "fullCaseOnly_DS", "full_case_only_ds", "fullCaseOnly", "full_case_only"));
    const unitWeightLb = get(map, "unitWeight", "unit_weight", "weightLb", "weight_lb");
    const returnable = boolean(get(map, "Returnable", "returnable"));
    const boxRequired = boolean(get(map, "BoxRequired", "boxRequired", "box_required"));
    const dropShipOnly = boolean(get(map, "DropShipOnly", "dropShipOnly", "drop_ship_only"));

    let moq = 1;
    let moqEvidence = "UNKNOWN";
    let moqEvidenceBasis = "S&S fullCaseOnly flag unavailable";
    if (fullCaseOnly === true && caseQty) {
      moq = caseQty;
      moqEvidence = "SUPPLIER_CONFIRMED";
      moqEvidenceBasis = "S&S fullCaseOnly=true; CaseQty is required quantity";
    } else if (fullCaseOnly === false) {
      moq = 1;
      moqEvidence = "SUPPLIER_SUPPORTED";
      moqEvidenceBasis = "S&S fullCaseOnly=false; full-case ordering is not required";
    }

    if (sourceSku) {
      metadataBySku[sourceSku] = {
        moq,
        moqEvidence,
        moqEvidenceBasis,
        fullCaseOnly,
        caseQty,
        retailPriceCents: moneyCents(get(map, "RetailPrice", "retailPrice", "retail_price")),
        mapPriceCents: moneyCents(get(map, "MAPPrice", "mapPrice", "map_price")),
        piecePriceCents: moneyCents(get(map, "piecePrice", "piece_price")),
        casePriceCents: moneyCents(get(map, "casePrice", "case_price")),
        returnable,
        boxRequired,
        dropShipOnly,
        supplierRowNumber: rowNumber,
      };
    }

    allowed.push({
      title,
      supplier: defaultSupplier,
      sku: sourceSku,
      upc: text(get(map, "gtin", "upc")),
      brand,
      cost: customerPrice,
      stock: get(map, "Qty", "qty", "inventory", "stock"),
      moq,
      weight_lb: unitWeightLb,
      condition: "New",
      noeRetailing: false,
    });
  });

  return {
    detected: true,
    supplier: defaultSupplier,
    sourceFormat: resolvedFormat,
    format: "json",
    content: JSON.stringify(allowed),
    inputCount: rows.length,
    allowedCount: allowed.length,
    prohibitedCount: prohibited.length,
    reviewCount: review.length,
    prohibited,
    review,
    metadataBySku,
  };
}
