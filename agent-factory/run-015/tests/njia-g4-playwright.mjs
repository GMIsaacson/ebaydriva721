import { chromium } from 'playwright';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const BEFORE_URL = process.env.NJIA_BEFORE_URL || 'http://127.0.0.1:4173';
const AFTER_URL = process.env.NJIA_AFTER_URL || 'http://127.0.0.1:4174';
const OUT = process.env.NJIA_EVIDENCE_DIR || 'agent-factory/run-015/evidence/runtime-njia-v2';
fs.mkdirSync(OUT, { recursive: true });

const viewports = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 820, height: 1180 },
  desktop: { width: 1440, height: 1000 },
};

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function hexToRgb(hex) {
  const h = hex.replace('#', '').trim();
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
function luminance(hex) {
  const [r,g,b] = hexToRgb(hex).map((c) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a,b) {
  const [hi,lo] = [luminance(a), luminance(b)].sort((x,y) => y-x);
  return (hi + 0.05) / (lo + 0.05);
}

const browser = await chromium.launch({ headless: true });
const evidence = {
  schemaVersion: '2.0',
  runId: 'UIX-015',
  assignment: 'Njia v2 benchmark-diversity non-regression qualification',
  lockedParentCommit: '48383a9af1c72f7e2e0128b734265581bab3f324',
  lockedParentScore: 93.4,
  candidateCommit: process.env.GITHUB_SHA || null,
  viewports: {},
  functionalChecks: [],
};

async function capture(label, url, viewportName, viewport) {
  const page = await browser.newPage({ viewport });
  await page.goto(url, { waitUntil: 'networkidle' });
  const metrics = await page.evaluate(() => ({
    title: document.title,
    viewportWidth: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    bodyWidth: document.body.scrollWidth,
    h1Count: document.querySelectorAll('h1').length,
    primaryNavCount: document.querySelectorAll('nav[aria-label="Primary navigation"] a').length,
    tableCount: document.querySelectorAll('table').length,
    detailsCount: document.querySelectorAll('details').length,
  }));
  const filename = path.join(OUT, `${label}-${viewportName}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  await page.close();
  return { ...metrics, screenshot: filename, screenshotSha256: sha256(filename) };
}

for (const [name, viewport] of Object.entries(viewports)) {
  const before = await capture('before', BEFORE_URL, name, viewport);
  const after = await capture('after', AFTER_URL, name, viewport);
  const noPageOverflow = after.documentWidth <= after.viewportWidth + 1 && after.bodyWidth <= after.viewportWidth + 1;
  evidence.viewports[name] = { before, after, noPageOverflow };
  evidence.functionalChecks.push({ id: `viewport-${name}-no-page-overflow`, status: noPageOverflow ? 'PASS' : 'FAIL' });
}

const desktop = await browser.newPage({ viewport: viewports.desktop });
await desktop.goto(AFTER_URL, { waitUntil: 'networkidle' });

const anchorIntegrity = await desktop.evaluate(() => {
  const hrefs = [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(Boolean);
  const missing = hrefs.filter(h => h !== '#' && !document.querySelector(h));
  return { total: hrefs.length, missing };
});
evidence.functionalChecks.push({ id: 'anchor-integrity', status: anchorIntegrity.missing.length === 0 ? 'PASS' : 'FAIL', detail: anchorIntegrity });

const semantics = await desktop.evaluate(() => ({
  lang: document.documentElement.lang,
  h1Count: document.querySelectorAll('h1').length,
  primaryNavLabel: document.querySelector('nav[aria-label="Primary navigation"]')?.getAttribute('aria-label') || null,
  tablesWithCaptions: [...document.querySelectorAll('table')].filter(t => t.querySelector('caption')).length,
  scopedHeaders: document.querySelectorAll('th[scope]').length,
  evidenceDetails: document.querySelectorAll('.evidence-item').length,
}));
const semanticsPass = semantics.lang === 'en-KE' && semantics.h1Count === 1 && semantics.primaryNavLabel === 'Primary navigation' && semantics.tablesWithCaptions >= 1 && semantics.scopedHeaders >= 1 && semantics.evidenceDetails >= 1;
evidence.functionalChecks.push({ id: 'semantic-structure', status: semanticsPass ? 'PASS' : 'FAIL', detail: semantics });

const questions = desktop.locator('.question');
const questionCount = await questions.count();
let detailsPass = questionCount >= 2;
if (detailsPass) {
  const second = questions.nth(1);
  await second.locator('summary').click();
  detailsPass = await second.evaluate(el => el.open === true);
}
evidence.functionalChecks.push({ id: 'ask-market-details-toggle', status: detailsPass ? 'PASS' : 'FAIL', detail: { questionCount } });

await desktop.keyboard.press('Tab');
const focusStyle = await desktop.evaluate(() => {
  const el = document.activeElement;
  const s = getComputedStyle(el);
  return {
    tagName: el?.tagName || null,
    href: el?.getAttribute?.('href') || null,
    outlineStyle: s.outlineStyle,
    outlineWidth: s.outlineWidth,
    outlineColor: s.outlineColor,
  };
});
const focusPass = focusStyle.tagName === 'A' && focusStyle.outlineStyle !== 'none' && parseFloat(focusStyle.outlineWidth) >= 2;
evidence.functionalChecks.push({ id: 'keyboard-focus-visible', status: focusPass ? 'PASS' : 'FAIL', detail: focusStyle });

const tokens = await desktop.evaluate(() => {
  const s = getComputedStyle(document.documentElement);
  return {
    canvas: s.getPropertyValue('--canvas').trim(),
    panel: s.getPropertyValue('--panel').trim(),
    inkFaint: s.getPropertyValue('--ink-faint').trim(),
    accent: s.getPropertyValue('--accent').trim(),
    accentBright: s.getPropertyValue('--accent-bright').trim(),
    positive: s.getPropertyValue('--positive').trim(),
    warning: s.getPropertyValue('--warning').trim(),
    danger: s.getPropertyValue('--danger').trim(),
    night: s.getPropertyValue('--night').trim(),
    nightMuted: s.getPropertyValue('--night-muted').trim(),
  };
});
const contrastChecks = {
  inkFaintOnCanvas: contrast(tokens.inkFaint, tokens.canvas),
  inkFaintOnPanel: contrast(tokens.inkFaint, tokens.panel),
  accentOnCanvas: contrast(tokens.accent, tokens.canvas),
  positiveOnCanvas: contrast(tokens.positive, tokens.canvas),
  warningOnCanvas: contrast(tokens.warning, tokens.canvas),
  dangerOnCanvas: contrast(tokens.danger, tokens.canvas),
  nightMutedOnNight: contrast(tokens.nightMuted, tokens.night),
  accentBrightOnNight: contrast(tokens.accentBright, tokens.night),
};
const contrastPass = Object.values(contrastChecks).every(v => v >= 4.5);
evidence.functionalChecks.push({ id: 'small-text-token-contrast', status: contrastPass ? 'PASS' : 'FAIL', detail: { tokens, contrastChecks } });

const typography = await desktop.evaluate(() => ({
  body: getComputedStyle(document.body).fontFamily,
  h1: getComputedStyle(document.querySelector('h1')).fontFamily,
  utility: getComputedStyle(document.querySelector('.eyebrow')).fontFamily,
}));
const serifPattern = /Georgia|Times New Roman|serif/i;
const typographyPass = !serifPattern.test(typography.h1) && !serifPattern.test(typography.body) && /mono|Consolas|Menlo|Liberation/i.test(typography.utility);
evidence.functionalChecks.push({ id: 'selected-direction-rendered-typography', status: typographyPass ? 'PASS' : 'FAIL', detail: typography });

const semanticSignalColors = await desktop.evaluate(() => ({
  rising: getComputedStyle(document.querySelector('.rising .direction')).color,
  tightening: getComputedStyle(document.querySelector('.tightening .direction')).color,
  dislocation: getComputedStyle(document.querySelector('.dislocation .direction')).color,
  intent: getComputedStyle(document.querySelector('.intent .direction')).color,
}));
const distinctSignalColors = new Set(Object.values(semanticSignalColors)).size === 4;
evidence.functionalChecks.push({ id: 'semantic-signal-color-differentiation', status: distinctSignalColors ? 'PASS' : 'FAIL', detail: semanticSignalColors });

const stickyHeader = await desktop.locator('.site-header').evaluate(el => getComputedStyle(el).position === 'sticky');
evidence.functionalChecks.push({ id: 'sticky-command-header', status: stickyHeader ? 'PASS' : 'FAIL' });
await desktop.close();

const mobile = await browser.newPage({ viewport: viewports.mobile });
await mobile.goto(AFTER_URL, { waitUntil: 'networkidle' });
const mobileNav = mobile.locator('.mobile-nav');
const mobileNavVisible = await mobileNav.isVisible();
await mobileNav.locator('summary').focus();
await mobile.keyboard.press('Enter');
const mobileNavOpen = await mobileNav.evaluate(el => el.open === true);
const mobileLinkCount = await mobileNav.locator('nav a').count();
evidence.functionalChecks.push({ id: 'mobile-navigation-keyboard-toggle', status: mobileNavVisible && mobileNavOpen && mobileLinkCount === 7 ? 'PASS' : 'FAIL', detail: { mobileNavVisible, mobileNavOpen, mobileLinkCount } });
const mobileTransformation = await mobile.evaluate(() => ({
  signalGridDisplay: getComputedStyle(document.querySelector('.signal-grid')).display,
  geoRouteColumns: getComputedStyle(document.querySelector('.geo-route')).gridTemplateColumns,
  tableOverflowX: getComputedStyle(document.querySelector('.table-wrap')).overflowX,
}));
const mobileTransformPass = mobileTransformation.signalGridDisplay === 'block' && mobileTransformation.tableOverflowX === 'auto';
evidence.functionalChecks.push({ id: 'mobile-density-transformation', status: mobileTransformPass ? 'PASS' : 'FAIL', detail: mobileTransformation });
await mobile.close();

const reduced = await browser.newContext({ reducedMotion: 'reduce', viewport: viewports.desktop });
const reducedPage = await reduced.newPage();
await reducedPage.goto(AFTER_URL, { waitUntil: 'networkidle' });
const reducedMotion = await reducedPage.evaluate(() => ({
  scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  transitionDuration: getComputedStyle(document.querySelector('.summary-arrow')).transitionDuration,
}));
const reducedPass = reducedMotion.scrollBehavior === 'auto' && parseFloat(reducedMotion.transitionDuration) <= 0.001;
evidence.functionalChecks.push({ id: 'reduced-motion', status: reducedPass ? 'PASS' : 'FAIL', detail: reducedMotion });
await reduced.close();

const allPass = evidence.functionalChecks.every(c => c.status === 'PASS');
evidence.status = allPass ? 'PASS' : 'FAIL';
evidence.completedAt = new Date().toISOString();
fs.writeFileSync(path.join(OUT, 'runtime-summary.json'), JSON.stringify(evidence, null, 2));

await browser.close();

if (!allPass) {
  console.error(JSON.stringify(evidence, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(evidence, null, 2));
