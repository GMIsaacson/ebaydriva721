'use strict';

function cents(value) {
  if (Number.isInteger(value)) return value;
  if (typeof value === 'number') return Math.round(value * 100);
  if (typeof value !== 'string') throw new Error(`Unsupported money value: ${value}`);
  const cleaned = value.replace(/[$,\s]/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) throw new Error(`Invalid money value: ${value}`);
  return Math.round(n * 100);
}

function qty(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid quantity: ${value}`);
  return n;
}

function normalizeShadowCase(raw) {
  return {
    engagement: { id: String(raw.engagementId) },
    vendor: { id: String(raw.vendorId), name: raw.vendorName || String(raw.vendorId) },
    evidenceArtifacts: (raw.evidence || []).map((e) => ({ ...e, id: String(e.id) })),
    rateCard: raw.rateCard ? {
      id: String(raw.rateCard.id),
      evidenceId: String(raw.rateCard.evidenceId),
      rates: (raw.rateCard.rates || []).map((r) => ({ code: String(r.code).trim().toUpperCase(), unitPriceCents: cents(r.unitPrice) }))
    } : null,
    invoices: (raw.invoices || []).map((inv) => ({
      id: String(inv.id),
      evidenceId: String(inv.evidenceId),
      lines: (inv.lines || []).map((line) => ({
        id: String(line.id),
        code: String(line.code).trim().toUpperCase(),
        quantity: qty(line.quantity),
        amountCents: cents(line.amount)
      }))
    })),
    payments: (raw.payments || []).map((p) => ({
      id: String(p.id), invoiceId: String(p.invoiceId), amountCents: cents(p.amount), paidAt: String(p.paidAt), evidenceId: String(p.evidenceId)
    })),
    credits: (raw.credits || []).map((c) => ({
      id: String(c.id), invoiceId: String(c.invoiceId), amountCents: cents(c.amount), evidenceId: String(c.evidenceId)
    })),
    appliedCredits: (raw.appliedCredits || []).map((a) => ({ ...a, creditId: String(a.creditId) }))
  };
}

module.exports = { cents, qty, normalizeShadowCase };
