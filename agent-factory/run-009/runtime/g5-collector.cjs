const { runShadowPipeline } = require('./g4-pipeline.cjs');

const ALLOWED_HOSTS = new Set([
  'lims.minneapolismn.gov',
  'www.bloomingtonmn.gov',
  'www.stpaul.gov',
  'www.maplegrovemn.gov',
]);

function assertReadOnlySource(source) {
  if (!source || source.enabled !== true) throw new Error('source_disabled');
  const u = new URL(source.baseUrl);
  if (u.protocol !== 'https:') throw new Error('https_required');
  if (!ALLOWED_HOSTS.has(u.hostname)) throw new Error('host_not_allowlisted');
  if (source.linkPattern) new RegExp(source.linkPattern);
  return true;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&amp;|&#39;|&quot;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectProjectSignals(text) {
  const t = String(text || '');
  const patterns = [
    /\b(?:new|proposed|construct(?:ion)?|redevelopment|development|expansion|alteration)\b[^.]{0,180}\b(?:apartment|multifamily|mixed-use|commercial|retail|office|hospital|campus|manufacturing|building|units?)\b/gi,
    /\b\d{2,4}\s+(?:unit|units)\b[^.]{0,180}/gi,
    /\b(?:conditional use permit|development plan|site plan|planned development)\b[^.]{0,180}/gi,
  ];
  const out = [];
  for (const pattern of patterns) {
    for (const m of t.matchAll(pattern)) out.push(m[0].trim());
  }
  return [...new Set(out)].slice(0, 25);
}

function extractSameHostLinks(html, baseUrl, linkPattern) {
  const base = new URL(baseUrl);
  const pattern = linkPattern ? new RegExp(linkPattern, 'i') : null;
  const links = [];
  for (const m of String(html || '').matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const u = new URL(m[1], base);
      if (u.protocol !== 'https:' || u.hostname !== base.hostname) continue;
      if (!ALLOWED_HOSTS.has(u.hostname)) continue;
      if (pattern && !pattern.test(u.pathname)) continue;
      u.hash = '';
      links.push(u.href);
    } catch {}
  }
  return [...new Set(links)];
}

async function fetchPage(url, source, fetchImpl) {
  const res = await fetchImpl(url, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'user-agent': 'Aberdeen-Municipal-Intel-Shadow/0.1' },
  });
  if (!res || !res.ok) throw new Error(`source_fetch_failed:${source.sourceId}`);
  const finalUrl = new URL(res.url || url);
  if (finalUrl.protocol !== 'https:' || !ALLOWED_HOSTS.has(finalUrl.hostname)) throw new Error('redirect_host_not_allowlisted');
  if (finalUrl.hostname !== new URL(source.baseUrl).hostname) throw new Error('redirect_cross_host_not_allowed');
  const body = await res.text();
  if (body.length > 2_000_000) throw new Error('source_response_too_large');
  return { finalUrl: finalUrl.href, body, text: stripHtml(body) };
}

async function collectSource(source, fetchImpl = fetch, maxPages = 5) {
  assertReadOnlySource(source);
  const root = await fetchPage(source.baseUrl, source, fetchImpl);
  const pages = [root];
  if (source.followLinks === true && maxPages > 1) {
    const links = extractSameHostLinks(root.body, root.finalUrl, source.linkPattern).slice(0, maxPages - 1);
    for (const link of links) {
      try { pages.push(await fetchPage(link, source, fetchImpl)); } catch (error) {
        pages.push({ finalUrl: link, body: '', text: '', error: error.message });
      }
    }
  }
  const signals = [...new Set(pages.flatMap(p => detectProjectSignals(p.text || '')))].slice(0, 50);
  return {
    sourceId: source.sourceId,
    municipality: source.municipality,
    source: root.finalUrl,
    observedAt: new Date().toISOString(),
    pagesAttempted: pages.length,
    pagesSucceeded: pages.filter(p => !p.error).length,
    pageUrls: pages.filter(p => !p.error).map(p => p.finalUrl),
    textLength: pages.reduce((n, p) => n + (p.text || '').length, 0),
    signals,
    authority: 'READ_ONLY',
  };
}

async function collectRegistry(registry, fetchImpl = fetch) {
  if (!registry || registry.mode !== 'READ_ONLY_MANUAL') throw new Error('manual_read_only_mode_required');
  if (registry.scheduleAuthorized !== false) throw new Error('schedule_must_be_disabled');
  const enabled = (registry.sources || []).filter(s => s.enabled);
  if (enabled.length > 10) throw new Error('source_count_limit_exceeded');
  const maxPages = Math.max(1, Math.min(Number(registry.maxPagesPerSourcePerRun || 5), 5));
  const results = [];
  const failures = [];
  for (const source of enabled) {
    try { results.push(await collectSource(source, fetchImpl, maxPages)); }
    catch (error) { failures.push({ sourceId: source.sourceId, error: error.message }); }
  }
  return {
    runId: registry.runId,
    gate: 'G5',
    authority: 'READ_ONLY_INTERNAL_ANALYSIS',
    externalActions: 0,
    scheduleAuthorized: false,
    sourcesAttempted: enabled.length,
    sourcesSucceeded: results.length,
    sourcesFailed: failures.length,
    failures,
    results,
  };
}

function collectorRecordsToPipelineCandidates(records) {
  const candidates = [];
  for (const r of records || []) {
    r.signals.forEach((signal, i) => {
      candidates.push({
        id: `${r.sourceId}-${i + 1}`,
        municipality: r.municipality,
        project: signal.slice(0, 100),
        signal,
        source: r.source,
        status: 'WATCH',
        confidence: 0.5,
        electricalThesis: 'Collector-only signal; requires extraction/enrichment before ACTIONABLE classification.',
      });
    });
  }
  return candidates;
}

function feedCollectedSignals(records) {
  return runShadowPipeline(collectorRecordsToPipelineCandidates(records));
}

module.exports = { assertReadOnlySource, stripHtml, detectProjectSignals, extractSameHostLinks, collectSource, collectRegistry, collectorRecordsToPipelineCandidates, feedCollectedSignals };
