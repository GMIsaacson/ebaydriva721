const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { generate, slugify } = require('../runtime/publish-site.cjs');

const runRoot = path.resolve(__dirname, '..');
const dataPath = path.join(runRoot, 'site', 'data', 'projects.json');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'run009-publish-'));
}

function read(root, relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

test('generates permanent project and taxonomy pages with canonical metadata', () => {
  const out = tmp();
  const result = generate({ dataPath, outDir: out, origin: 'https://radar.example' });
  assert.equal(result.projects, 5);
  assert.equal(result.indexable, true);

  const payload = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  for (const project of payload.projects) {
    const rel = path.join('projects', slugify(project.id || project.name), 'index.html');
    assert.ok(fs.existsSync(path.join(out, rel)), `missing ${rel}`);
    const html = read(out, rel);
    assert.match(html, /<meta name="robots" content="index,follow"/);
    assert.match(html, /<link rel="canonical" href="https:\/\/radar\.example\/projects\//);
    assert.match(html, /application\/ld\+json/);
    assert.ok(html.includes(project.sourceUrl));
    assert.ok(html.includes(`/municipalities/${slugify(project.municipality)}/`));
    assert.ok(fs.existsSync(path.join(out, 'stages', slugify(project.stage), 'index.html')), `missing stage taxonomy for ${project.stage}`);
  }

  assert.ok(fs.existsSync(path.join(out, 'municipalities', 'minneapolis', 'index.html')));
  assert.ok(fs.existsSync(path.join(out, 'municipalities', 'bloomington', 'index.html')));
  assert.ok(fs.existsSync(path.join(out, 'municipalities', 'saint-paul', 'index.html')));
  assert.ok(fs.existsSync(path.join(out, 'types', 'mixed-use', 'index.html')));
  assert.ok(fs.existsSync(path.join(out, 'types', 'multifamily', 'index.html')));
  assert.ok(fs.existsSync(path.join(out, 'stages', 'approved', 'index.html')));
  assert.ok(fs.existsSync(path.join(out, 'stages', 'under-construction', 'index.html')));

  const sitemap = read(out, 'sitemap.xml');
  assert.match(sitemap, /https:\/\/radar\.example\/projects\/run009-2116-nicollet-minneapolis\//);
  assert.match(sitemap, /https:\/\/radar\.example\/municipalities\/minneapolis\//);
  assert.equal(read(out, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://radar.example/sitemap.xml\n');
});

test('local generation is non-indexable when no origin is configured', () => {
  const out = tmp();
  const result = generate({ dataPath, outDir: out });
  assert.equal(result.indexable, false);
  const html = read(out, path.join('projects', 'run009-2116-nicollet-minneapolis', 'index.html'));
  assert.match(html, /<meta name="robots" content="noindex,nofollow"/);
  assert.equal(read(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
});

test('production generation fails closed without explicit SITE_ORIGIN', () => {
  const out = tmp();
  assert.throws(() => generate({ dataPath, outDir: out, production: true }), /production_origin_required/);
});

test('slugification is deterministic and URL-safe', () => {
  assert.equal(slugify('Saint Paul'), 'saint-paul');
  assert.equal(slugify('86th & 87th Townhome Redevelopment'), '86th-87th-townhome-redevelopment');
});
