'use strict';
const crypto=require('crypto');
function sha256Text(v){return crypto.createHash('sha256').update(String(v??'')).digest('hex');}
function uniq(xs){return [...new Set(xs)];}
function extractHtmlClasses(html){const out=[];for(const m of String(html||'').matchAll(/\bclass\s*=\s*["']([^"']+)["']/gi))out.push(...m[1].split(/\s+/).filter(Boolean));return uniq(out);}
function extractCssClasses(css){const out=[],cleaned=String(css||'').replace(/\/\*[\s\S]*?\*\//g,' ');for(const m of cleaned.matchAll(/\.([A-Za-z_][A-Za-z0-9_-]*)/g))out.push(m[1]);return uniq(out);}
function cssBraceBalance(css){let n=0;for(const ch of String(css||'')){if(ch==='{')n++;else if(ch==='}')n--;if(n<0)return false;}return n===0;}
function suspiciousCss(css){const issues=[],s=String(css||'');if(!cssBraceBalance(s))issues.push('CSS_BRACE_IMBALANCE');if(/rgba?\([^)]*[A-Za-z]{3,}[^)]*\)/i.test(s))issues.push('CSS_INVALID_COLOR_TOKEN');if(/\b(?:Fifty|undefined|null|NaN)\b/.test(s))issues.push('CSS_INVALID_LITERAL');return issues;}
function extractLinks(html){return[...String(html||'').matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1]);}
function extractImageSrc(html){return[...String(html||'').matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1]);}
function allowedLink(href,approved){const h=String(href||'').trim();if(!h)return false;if(/^(?:#|tel:|mailto:)/i.test(h))return true;if(/^https?:\/\//i.test(h))return approved.has(h);return !/^(?:javascript:|data:)/i.test(h);}
function checkSource({files,approvedLinks=[],approvedAssets=[],requiredStrings=[]}){
  const checks=[],add=(id,ok,detail='')=>checks.push({id,status:ok?'PASS':'FAIL',detail});
  const html=String(files?.['index.html']||''),css=String(files?.['styles.css']||'');
  add('index-html-present',html.length>=500,`bytes=${Buffer.byteLength(html)}`);
  add('styles-css-present',css.length>=300,`bytes=${Buffer.byteLength(css)}`);
  add('stylesheet-linked',/<link[^>]+href=["'](?:\.\/)?styles\.css["']/i.test(html),'index.html -> styles.css');
  add('one-h1',(html.match(/<h1\b/gi)||[]).length===1,`h1=${(html.match(/<h1\b/gi)||[]).length}`);
  for(const tag of ['nav','main','footer'])add(`semantic-${tag}`,new RegExp(`<${tag}\\b`,'i').test(html),tag);
  add('focus-visible',/:focus-visible/i.test(css),'focus-visible');
  add('responsive-css',/@media/i.test(css),'media');
  add('reduced-motion',/prefers-reduced-motion/i.test(css),'reduced-motion');
  const cssIssues=suspiciousCss(css);for(const issue of cssIssues)add(`css:${issue}`,false,issue);if(!cssIssues.length)add('css-syntax-sanity',true,'balanced/no suspicious literal colors');
  const htmlClasses=extractHtmlClasses(html),cssClasses=extractCssClasses(css),cssOnly=cssClasses.filter(c=>!htmlClasses.includes(c)).filter(c=>!['open','active','hidden','sr-only'].includes(c));
  add('dom-css-drift',cssOnly.length<=6,`cssOnly=${cssOnly.slice(0,12).join(',')}`);
  const approved=new Set(approvedLinks.map(String)),badLinks=extractLinks(html).filter(h=>!allowedLink(h,approved));
  add('approved-link-integrity',badLinks.length===0,`bad=${badLinks.slice(0,8).join(',')}`);
  const assets=new Set(approvedAssets.map(String)),badAssets=extractImageSrc(html).filter(src=>/^https?:\/\//i.test(src)&&!assets.has(src));
  add('approved-asset-integrity',badAssets.length===0,`bad=${badAssets.slice(0,8).join(',')}`);
  const low=html.toLowerCase();for(const s of requiredStrings.filter(x=>typeof x==='string'&&x.trim().length>=2))add(`preserve:${s.slice(0,32)}`,low.includes(s.toLowerCase()),s);
  add('no-network-js',!/(fetch\s*\(|XMLHttpRequest|sendBeacon)/i.test(html),'no network code');
  add('no-external-js',!/<script[^>]+\bsrc=/i.test(html),'no external script');
  return checks;
}
function checkArtifact({files,approvedLinks=[],approvedAssets=[],requiredStrings=[],browserEvidence=null,visualQa=null,repairReceipts=[]}){
  const checks=checkSource({files,approvedLinks,approvedAssets,requiredStrings}),add=(id,ok,detail='')=>checks.push({id,status:ok?'PASS':'FAIL',detail});
  if(browserEvidence){for(const vp of ['mobile','tablet','desktop'])add(`browser-${vp}`,browserEvidence?.[vp]?.status==='PASS',JSON.stringify(browserEvidence?.[vp]||{}));add('browser-overflow',browserEvidence?.overflow==='PASS',String(browserEvidence?.overflow||'missing'));add('browser-navigation',browserEvidence?.navigation==='PASS',String(browserEvidence?.navigation||'missing'));add('browser-images',browserEvidence?.images==='PASS',String(browserEvidence?.images||'missing'));}else add('browser-evidence-required',false,'missing');
  if(visualQa){add('visual-implementation-qa',visualQa.status==='PASS',visualQa.status||'missing');add('visual-qa-independent',visualQa.implementer!==visualQa.reviewer,`${visualQa.implementer||''} vs ${visualQa.reviewer||''}`);add('contrast-qa',visualQa.contrastStatus==='PASS',visualQa.contrastStatus||'missing');add('creative-fidelity',visualQa.creativeFidelity==='PASS',visualQa.creativeFidelity||'missing');}else add('visual-qa-required',false,'missing');
  add('repair-receipts-bounded',repairReceipts.length<=4,`repairs=${repairReceipts.length}`);
  return checks;
}
function result(input){const checks=checkArtifact(input),failed=checks.filter(x=>x.status!=='PASS');return{status:failed.length?'REVISE':'PASS',checks,failed,artifactHashes:Object.fromEntries(Object.entries(input.files||{}).map(([k,v])=>[k,sha256Text(v)]))};}
function sourceResult(input){const checks=checkSource(input),failed=checks.filter(x=>x.status!=='PASS');return{status:failed.length?'REVISE':'PASS',checks,failed};}
module.exports={sha256Text,extractHtmlClasses,extractCssClasses,cssBraceBalance,suspiciousCss,extractLinks,extractImageSrc,allowedLink,checkSource,checkArtifact,sourceResult,result};
