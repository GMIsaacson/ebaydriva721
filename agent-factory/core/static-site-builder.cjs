#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const VERSION = '1.0.0';
const REQUIRED_PAGES = ['home', 'services', 'about', 'referrals', 'contact'];

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function slug(value) { return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }

function validateSpec(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('site spec is required');
  if (!spec.brand || !String(spec.brand.name||'').trim()) throw new Error('brand.name is required');
  if (!spec.contact || !String(spec.contact.phone||'').trim() || !String(spec.contact.email||'').trim()) throw new Error('contact phone and email are required');
  if (!Array.isArray(spec.pages) || spec.pages.length < REQUIRED_PAGES.length) throw new Error('at least five pages are required');
  const slugs = spec.pages.map((p) => slug(p.slug || p.title));
  for (const required of REQUIRED_PAGES) if (!slugs.includes(required)) throw new Error(`required page missing: ${required}`);
  if (new Set(slugs).size !== slugs.length) throw new Error('page slugs must be unique');
  for (const [i,page] of spec.pages.entries()) {
    if (!String(page.title||'').trim()) throw new Error(`pages[${i}].title is required`);
    if (!Array.isArray(page.sections) || page.sections.length === 0) throw new Error(`pages[${i}].sections are required`);
    for (const [j,section] of page.sections.entries()) {
      if (!String(section.heading||'').trim() || !String(section.body||'').trim()) throw new Error(`pages[${i}].sections[${j}] heading/body required`);
      if (!Array.isArray(section.sourceRefs) || section.sourceRefs.length === 0) throw new Error(`pages[${i}].sections[${j}] must carry sourceRefs`);
    }
  }
  if (!Array.isArray(spec.sourceIndex) || spec.sourceIndex.length === 0) throw new Error('sourceIndex is required');
  return { slugs };
}

function css() {
  return `:root{font-family:Inter,system-ui,sans-serif;color:#17212b;background:#f7f7f4}*{box-sizing:border-box}body{margin:0}header{background:#fff;border-bottom:1px solid #ddd;position:sticky;top:0}nav{max-width:1120px;margin:auto;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;gap:20px}nav a{color:#17212b;text-decoration:none;margin-left:18px}main{max-width:1120px;margin:auto;padding:64px 24px}.hero{padding:58px 0}.hero h1{font-size:clamp(2.4rem,6vw,4.8rem);line-height:.98;max-width:900px;margin:0 0 24px}.kicker{text-transform:uppercase;letter-spacing:.12em;font-weight:700}.cta{display:inline-block;background:#17212b;color:#fff;padding:14px 18px;border-radius:8px;text-decoration:none}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px}.card{background:#fff;padding:24px;border:1px solid #e2e2dc;border-radius:14px}.card h2{margin-top:0}footer{background:#17212b;color:#fff;padding:32px 24px}footer div{max-width:1120px;margin:auto}.evidence{font-size:.78rem;color:#667085;margin-top:14px}@media(max-width:700px){nav{align-items:flex-start;flex-direction:column}nav a{margin:0 12px 0 0}}`;
}

function pageHtml(spec, page) {
  const links = spec.pages.map((p) => `<a href="${slug(p.slug||p.title)==='home'?'index.html':slug(p.slug||p.title)+'.html'}">${esc(p.title)}</a>`).join('');
  const sections = page.sections.map((s) => `<section class="card"><h2>${esc(s.heading)}</h2><p>${esc(s.body)}</p><div class="evidence">Evidence: ${s.sourceRefs.map(esc).join(', ')}</div></section>`).join('');
  const hero = page.hero || {};
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)} | ${esc(spec.brand.name)}</title><meta name="description" content="${esc(hero.subhead||page.sections[0].body)}"><link rel="stylesheet" href="styles.css"></head><body><header><nav><strong>${esc(spec.brand.name)}</strong><div>${links}</div></nav></header><main><section class="hero"><div class="kicker">${esc(hero.kicker||'Home care in Minnesota')}</div><h1>${esc(hero.headline||page.title)}</h1><p>${esc(hero.subhead||'Person-centered support designed around daily life at home.')}</p><a class="cta" href="contact.html">${esc(hero.cta||'Get in touch')}</a></section><div class="grid">${sections}</div></main><footer><div><strong>${esc(spec.brand.name)}</strong><p>${esc(spec.contact.address||'Minneapolis, Minnesota')}</p><p>${esc(spec.contact.phone)} · ${esc(spec.contact.email)}</p><p>Acceptance demo only — not an authorized production site.</p></div></footer></body></html>`;
}

function build(spec, outDir) {
  const { slugs } = validateSpec(spec);
  const target = path.resolve(outDir);
  if (fs.existsSync(target)) throw new Error(`output already exists: ${target}`);
  const temp = `${target}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.mkdirSync(temp, {recursive:true});
    fs.writeFileSync(path.join(temp,'styles.css'), css());
    const files=[];
    spec.pages.forEach((page, i) => {
      const s=slugs[i], file=s==='home'?'index.html':`${s}.html`, html=pageHtml(spec,page);
      fs.writeFileSync(path.join(temp,file),html); files.push({file,sha256:hash(html)});
    });
    const qa={status:'PASS',version:VERSION,pageCount:files.length,requiredPages:REQUIRED_PAGES,files,externalActionsPerformed:0,spendCents:0,deploymentsPerformed:0,sourceCount:spec.sourceIndex.length};
    fs.writeFileSync(path.join(temp,'artifact-receipt.json'),JSON.stringify(qa,null,2)+'\n');
    fs.renameSync(temp,target);
    return qa;
  } catch(e) { fs.rmSync(temp,{recursive:true,force:true}); throw e; }
}

if(require.main===module){
 const a=process.argv.slice(2), si=a.indexOf('--spec'), oi=a.indexOf('--out');
 if(si<0||oi<0||!a[si+1]||!a[oi+1]){console.error('Usage: node static-site-builder.cjs --spec <json> --out <dir>');process.exit(2)}
 try{const result=build(JSON.parse(fs.readFileSync(a[si+1],'utf8')),a[oi+1]);console.log(JSON.stringify(result));}catch(e){console.error(JSON.stringify({status:'BLOCKED',error:e.message}));process.exit(2)}
}
module.exports={VERSION,REQUIRED_PAGES,validateSpec,pageHtml,build};
