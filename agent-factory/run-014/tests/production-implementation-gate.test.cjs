'use strict';
const assert=require('assert');
const Gate=require('../runtime/production-implementation-gate.cjs');

const approved=['https://example.com/services/','https://example.com/contact/'];
const goodHtml=`<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><nav><a href="https://example.com/services/">Services</a></nav><main><h1>Warm care</h1><p>Since 2017</p><p>${'Trusted support. '.repeat(30)}</p><img src="x.jpg"></main><footer><a href="https://example.com/contact/">Contact</a></footer></body></html>`;
const goodCss=`:root{--ink:#123;--space:1rem;--surface:#fff;--accent:#fc0}.x{color:var(--ink);padding:var(--space);background:var(--surface);margin:var(--space);border:1px solid #ddd}.x:hover{color:#234}.x strong{font-weight:700}.x a{text-decoration:underline}.x img{max-width:100%;height:auto}:focus-visible{outline:3px solid #fc0}@media(max-width:700px){.x{display:block}}@media(prefers-reduced-motion:reduce){*{transition:none}}`;
const browser={mobile:{status:'PASS'},tablet:{status:'PASS'},desktop:{status:'PASS'},overflow:'PASS',navigation:'PASS',images:'PASS'};
const visual={status:'PASS',contrastStatus:'PASS',creativeFidelity:'PASS',implementer:'implementation',reviewer:'visual-implementation-qa'};
let r=Gate.result({files:{'index.html':goodHtml,'styles.css':goodCss},approvedLinks:approved,requiredStrings:['Since 2017'],browserEvidence:browser,visualQa:visual,repairReceipts:[]});
assert.equal(r.status,'PASS'); assert.equal(r.failed.length,0);

r=Gate.result({files:{'index.html':goodHtml.replace('https://example.com/services/','https://invented.example/foo'),'styles.css':goodCss},approvedLinks:approved,requiredStrings:['Since 2017'],browserEvidence:browser,visualQa:visual,repairReceipts:[]});
assert(r.failed.some(x=>x.id==='approved-link-integrity'));

r=Gate.result({files:{'index.html':goodHtml,'styles.css':goodCss+' .bad{box-shadow:0 1px 2px rgba(32,43,Fifty,.1)}'},approvedLinks:approved,requiredStrings:['Since 2017'],browserEvidence:browser,visualQa:visual,repairReceipts:[]});
assert(r.failed.some(x=>x.id==='css:CSS_INVALID_COLOR_TOKEN'));

r=Gate.result({files:{'index.html':goodHtml,'styles.css':goodCss},approvedLinks:approved,requiredStrings:['Since 2017'],browserEvidence:null,visualQa:visual,repairReceipts:[]});
assert(r.failed.some(x=>x.id==='browser-evidence-required'));

r=Gate.result({files:{'index.html':goodHtml,'styles.css':goodCss},approvedLinks:approved,requiredStrings:['Since 2017'],browserEvidence:browser,visualQa:{...visual,status:'REVISE'},repairReceipts:[]});
assert(r.failed.some(x=>x.id==='visual-implementation-qa'));

assert(Gate.extractHtmlClasses('<div class="a b"></div>').includes('a'));
assert(Gate.extractCssClasses('.a{color:red}.b:hover{}').includes('b'));
assert.equal(Gate.cssBraceBalance('.a{color:red}'),true);
assert.equal(Gate.cssBraceBalance('.a{color:red'),false);
console.log('production-implementation-gate: 8/8 PASS');
