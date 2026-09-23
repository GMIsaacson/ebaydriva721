'use strict';

const BASE = 'https://api.massive.com';

function requireKey(apiKey) {
  const key = apiKey || process.env.MASSIVE_API_KEY || process.env.POLYGON_API_KEY;
  if (!key) throw new Error('MASSIVE_API_KEY is required for Massive historical data');
  return key;
}

async function getJson(url, apiKey) {
  const key = requireKey(apiKey);
  const u = new URL(url);
  u.searchParams.set('apiKey', key);
  const res = await fetch(u, { headers: { accept: 'application/json', 'user-agent': 'run017-research/1.0' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Massive ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function paginate(url, apiKey, maxPages = 20) {
  const out = [];
  let next = url;
  for (let page = 0; next && page < maxPages; page += 1) {
    const json = await getJson(next, apiKey);
    if (Array.isArray(json.results)) out.push(...json.results);
    next = json.next_url || null;
  }
  return out;
}

async function listOptionContracts({
  underlying = 'SPY',
  expirationDate,
  asOf,
  contractType,
  strikeGte,
  strikeLte,
  expired = true,
  apiKey
}) {
  const u = new URL(`${BASE}/v3/reference/options/contracts`);
  u.searchParams.set('underlying_ticker', underlying);
  u.searchParams.set('expired', String(expired));
  u.searchParams.set('limit', '1000');
  u.searchParams.set('order', 'asc');
  u.searchParams.set('sort', 'strike_price');
  if (expirationDate) u.searchParams.set('expiration_date', expirationDate);
  if (asOf) u.searchParams.set('as_of', asOf);
  if (contractType) u.searchParams.set('contract_type', contractType);
  if (Number.isFinite(strikeGte)) u.searchParams.set('strike_price.gte', String(strikeGte));
  if (Number.isFinite(strikeLte)) u.searchParams.set('strike_price.lte', String(strikeLte));
  return paginate(u.toString(), apiKey);
}

async function getAggregates({ ticker, from, to, multiplier = 1, timespan = 'minute', apiKey }) {
  const symbol = encodeURIComponent(ticker);
  const u = new URL(`${BASE}/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}`);
  u.searchParams.set('adjusted', 'true');
  u.searchParams.set('sort', 'asc');
  u.searchParams.set('limit', '50000');
  const json = await getJson(u.toString(), apiKey);
  return (json.results || []).map(r => ({
    timestampMs: r.t,
    open: r.o,
    high: r.h,
    low: r.l,
    close: r.c,
    volume: r.v,
    vwap: r.vw ?? null,
    transactions: r.n ?? null
  }));
}

async function getOptionQuotes({ ticker, timestampGte, timestampLte, apiKey, maxPages = 50 }) {
  const symbol = encodeURIComponent(ticker);
  const u = new URL(`${BASE}/v3/quotes/${symbol}`);
  u.searchParams.set('limit', '1000');
  u.searchParams.set('order', 'asc');
  u.searchParams.set('sort', 'timestamp');
  if (timestampGte != null) u.searchParams.set('timestamp.gte', String(timestampGte));
  if (timestampLte != null) u.searchParams.set('timestamp.lte', String(timestampLte));
  const rows = await paginate(u.toString(), apiKey, maxPages);
  return rows.map(q => ({
    sipTimestampNs: q.sip_timestamp,
    bid: q.bid_price,
    ask: q.ask_price,
    bidSize: q.bid_size,
    askSize: q.ask_size,
    bidExchange: q.bid_exchange,
    askExchange: q.ask_exchange
  }));
}

function nearestQuote(quotes, timestampNs, maxAgeSeconds = 2) {
  if (!Array.isArray(quotes) || !quotes.length) return null;
  let best = null;
  let bestDelta = Infinity;
  for (const q of quotes) {
    const delta = Math.abs(Number(q.sipTimestampNs) - Number(timestampNs));
    if (delta < bestDelta) { best = q; bestDelta = delta; }
  }
  if (!best) return null;
  const ageSeconds = bestDelta / 1e9;
  if (ageSeconds > maxAgeSeconds) return null;
  return { ...best, ageSeconds };
}

module.exports = {
  BASE,
  listOptionContracts,
  getAggregates,
  getOptionQuotes,
  nearestQuote
};
