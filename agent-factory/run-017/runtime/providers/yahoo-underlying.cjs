'use strict';

function toEtParts(timestampSeconds) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).formatToParts(new Date(timestampSeconds * 1000));
  const get = type => parts.find(p => p.type === type)?.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}:${get('second')}`
  };
}

async function getChart({ symbol = 'SPY', range = '60d', interval = '5m' } = {}) {
  const u = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  u.searchParams.set('range', range);
  u.searchParams.set('interval', interval);
  u.searchParams.set('includePrePost', 'false');
  u.searchParams.set('events', 'div,splits');

  const res = await fetch(u, {
    headers: {
      accept: 'application/json,text/plain,*/*',
      'user-agent': 'Mozilla/5.0 Run017Research/1.0'
    }
  });
  if (!res.ok) throw new Error(`Yahoo chart ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo chart returned no result: ${json?.chart?.error?.description || 'unknown error'}`);

  const timestamps = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const bars = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const row = { open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], close: q.close?.[i], volume: q.volume?.[i] };
    if (![row.open, row.high, row.low, row.close].every(Number.isFinite)) continue;
    const et = toEtParts(timestamps[i]);
    bars.push({
      timestampMs: timestamps[i] * 1000,
      dateEt: et.date,
      timeEt: et.time.slice(0, 5),
      ...row
    });
  }
  return {
    provider: 'YAHOO_UNOFFICIAL_BOOTSTRAP',
    symbol,
    range,
    interval,
    bars,
    disclaimer: 'Unofficial public chart endpoint used only for bootstrap directional proxy research; never for execution or research-grade options P&L.'
  };
}

module.exports = { getChart, toEtParts };
