#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RUN_ROOT = path.resolve(__dirname, '..');
const DEFAULT_DATA = path.join(RUN_ROOT, 'site', 'data', 'projects.json');
const DEFAULT_OUT = path.join(RUN_ROOT, 'site');

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function pretty(value) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function money(value) {
  if (value == null) return 'Value not published';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--data' && argv[i + 1]) args.data = argv[++i];
    else if (argv[i] === '--out' && argv[i + 1]) args.out = argv[++i];
    else if (argv[i] === '--origin' && argv[i + 1]) args.origin = argv[++i];
  }
  return args;
}

function normalizeOrigin(value) {
  const origin = String(value || '').trim().replace(/\/$/, '');
  if (!origin) return null;
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('origin_protocol_not_allowed');
  return url.origin;
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, content, 'utf8');
}

function canonical(origin, pathname) {
  return origin ? `${origin}${pathname}` : pathname;
}

function layout({ title, description, body, canonicalUrl, robots = 'index,follow', structuredData = null }) {
  const jsonLd = structuredData ? `<script type="application/ld+json">${JSON.stringify(structuredData).replaceAll('<', '\\u003c')}</script>` : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="${esc(robots)}" />
  <link rel="canonical" href="${esc(canonicalUrl)}" />
  <link rel="stylesheet" href="/styles.css" />
  ${jsonLd}
</head>
<body>
  <header class="shell hero compact-hero"><nav class="nav"><a href="/" class="brand">Project Radar</a><span class="badge">Twin Cities pilot</span></nav></header>
  <main class="shell">${body}</main>
  <footer class="shell footer">Project Radar · Twin Cities pilot · Public-source intelligence</footer>
</body>
</html>`;
}

function projectPath(project) {
  return `/projects/${slugify(project.id || project.name)}/`;
}

function projectCard(project) {
  return `<article class="project-card">
    <div class="project-meta"><span class="chip">${esc(project.municipality)}</span><span class="chip">${esc(pretty(project.stage))}</span><span class="chip">${esc(pretty(project.projectType))}</span></div>
    <h3><a href="${projectPath(project)}">${esc(project.name)}</a></h3>
    <p>${esc(project.location)} · ${esc(money(project.estimatedValue))}</p>
  </article>`;
}

function projectPage(project, origin, indexable) {
  const pathname = projectPath(project);
  const title = `${project.name} — ${project.municipality} development signal | Project Radar`;
  const description = `${project.name} in ${project.municipality}: ${pretty(project.stage)} ${pretty(project.projectType)} development signal with authoritative municipal source and freshness status.`;
  const body = `<section class="search-panel detail-page">
    <p class="eyebrow">${esc(project.municipality)} · ${esc(pretty(project.stage))}</p>
    <h1 class="detail-title">${esc(project.name)}</h1>
    <p class="lede">${esc(project.signal)}</p>
    <div class="detail-grid">
      <div class="detail-box"><strong>Location</strong><br>${esc(project.location)}</div>
      <div class="detail-box"><strong>Project type</strong><br><a href="/types/${slugify(project.projectType)}/">${esc(pretty(project.projectType))}</a></div>
      <div class="detail-box"><strong>Stage</strong><br><a href="/stages/${slugify(project.stage)}/">${esc(pretty(project.stage))}</a></div>
      <div class="detail-box"><strong>Estimated value</strong><br>${esc(money(project.estimatedValue))}</div>
      <div class="detail-box"><strong>Confidence</strong><br>${Math.round(Number(project.confidence || 0) * 100)}%</div>
      <div class="detail-box"><strong>Freshness</strong><br>${esc(project.freshness)} · verified ${esc(project.lastVerified)}</div>
    </div>
    <p><a href="/municipalities/${slugify(project.municipality)}/">More ${esc(project.municipality)} project signals</a></p>
    <p><strong>Authoritative source:</strong><br><a class="source-link" href="${esc(project.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(project.sourceLabel)}</a></p>
    <p class="fine">Discovery signal only. Verify current status at the authoritative source before acting.</p>
  </section>`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: project.name,
    description,
    url: canonical(origin, pathname),
    spatialCoverage: project.municipality,
    dateModified: project.lastVerified,
    isBasedOn: project.sourceUrl,
    creator: { '@type': 'Organization', name: 'Project Radar' }
  };
  return layout({ title, description, body, canonicalUrl: canonical(origin, pathname), robots: indexable ? 'index,follow' : 'noindex,nofollow', structuredData });
}

function landingPage({ kind, label, slug, items, origin, indexable }) {
  const base = kind === 'municipality' ? 'municipalities' : kind === 'type' ? 'types' : 'stages';
  const pathname = `/${base}/${slug}/`;
  const heading = kind === 'municipality' ? `${label} commercial development signals` : `${label} project signals`;
  const description = `Browse ${items.length} Project Radar development signal${items.length === 1 ? '' : 's'} for ${label}, with public-source evidence and freshness status.`;
  const body = `<section class="search-panel">
    <p class="eyebrow">${esc(pretty(kind))}</p>
    <h1 class="detail-title">${esc(heading)}</h1>
    <p class="lede">${esc(description)}</p>
    <div class="project-grid">${items.map(projectCard).join('\n')}</div>
  </section>`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: heading,
    description,
    url: canonical(origin, pathname),
    mainEntity: items.map(p => ({ '@type': 'Dataset', name: p.name, url: canonical(origin, projectPath(p)) }))
  };
  return layout({ title: `${heading} | Project Radar`, description, body, canonicalUrl: canonical(origin, pathname), robots: indexable ? 'index,follow' : 'noindex,nofollow', structuredData });
}

function generate({ dataPath = DEFAULT_DATA, outDir = DEFAULT_OUT, origin = null, production = false } = {}) {
  const normalizedOrigin = normalizeOrigin(origin || process.env.SITE_ORIGIN || '');
  if (production && !normalizedOrigin) throw new Error('production_origin_required');
  const indexable = Boolean(normalizedOrigin);
  const payload = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const projects = Array.isArray(payload.projects) ? payload.projects : [];
  if (!projects.length) throw new Error('no_projects_to_publish');

  const written = [];
  const write = (relativePath, content) => {
    const full = path.join(outDir, relativePath);
    writeFile(full, content);
    written.push(relativePath.replace(/\\/g, '/'));
  };

  for (const project of projects) {
    write(path.join('projects', slugify(project.id || project.name), 'index.html'), projectPage(project, normalizedOrigin, indexable));
  }

  for (const [municipality, items] of groupBy(projects, p => p.municipality)) {
    write(path.join('municipalities', slugify(municipality), 'index.html'), landingPage({ kind: 'municipality', label: municipality, slug: slugify(municipality), items, origin: normalizedOrigin, indexable }));
  }
  for (const [type, items] of groupBy(projects, p => p.projectType)) {
    write(path.join('types', slugify(type), 'index.html'), landingPage({ kind: 'type', label: pretty(type), slug: slugify(type), items, origin: normalizedOrigin, indexable }));
  }
  for (const [stage, items] of groupBy(projects, p => p.stage)) {
    write(path.join('stages', slugify(stage), 'index.html'), landingPage({ kind: 'stage', label: pretty(stage), slug: slugify(stage), items, origin: normalizedOrigin, indexable }));
  }

  const publicPaths = [
    '/',
    ...projects.map(projectPath),
    ...[...groupBy(projects, p => p.municipality).keys()].map(v => `/municipalities/${slugify(v)}/`),
    ...[...groupBy(projects, p => p.projectType).keys()].map(v => `/types/${slugify(v)}/`),
    ...[...groupBy(projects, p => p.stage).keys()].map(v => `/stages/${slugify(v)}/`)
  ];

  const sitemap = normalizedOrigin
    ? `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publicPaths.map(p => `  <url><loc>${esc(canonical(normalizedOrigin, p))}</loc></url>`).join('\n')}\n</urlset>\n`
    : `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`;
  write('sitemap.xml', sitemap);
  write('robots.txt', normalizedOrigin ? `User-agent: *\nAllow: /\nSitemap: ${normalizedOrigin}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n');

  return { projects: projects.length, pages: written.length, written, origin: normalizedOrigin, indexable };
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const result = generate({
    dataPath: args.data ? path.resolve(args.data) : DEFAULT_DATA,
    outDir: args.out ? path.resolve(args.out) : DEFAULT_OUT,
    origin: args.origin || null,
    production: process.env.NODE_ENV === 'production'
  });
  console.log(JSON.stringify({ suite: 'RUN009_PUBLISHING_ENGINE', status: 'PASS', ...result }));
}

module.exports = { slugify, projectPath, generate };
