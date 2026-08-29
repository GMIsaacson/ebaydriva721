const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const Mod = require('../runtime/run014-creative-refinement-v4-executor.cjs');

test('V4 marker is isolated',()=>{
  assert.equal(Mod.shouldUse({team:{id:'SW-PROD-014'},instruction:'[CREATIVE_REFINE_V4] x'}),true);
  assert.equal(Mod.shouldUse({team:{id:'SW-PROD-014'},instruction:'[CREATIVE_REFINE_V3] x'}),false);
});

test('V3 Candidate A is too structurally similar for V4',()=>{
  const baseline=fs.readFileSync('/artifacts/WC-20260829035033-ba4169eef4/baseline/index.html','utf8');
  const weak=fs.readFileSync('/artifacts/WC-20260829035033-ba4169eef4/candidate-a/index.html','utf8');
  const d=Mod.structuralDelta(baseline,weak);
  assert.equal(d.pass,false,JSON.stringify(d));
  assert.ok(d.distance<6 || d.ratio<0.025,JSON.stringify(d));
});

test('material DOM recomposition clears deterministic structure threshold',()=>{
  const baseline=fs.readFileSync('/artifacts/WC-20260829035033-ba4169eef4/baseline/index.html','utf8');
  let strong=baseline;
  strong=strong.replace('<div class="services-grid">','<div class="services-composition"><div class="core-services"><div class="services-grid">');
  strong=strong.replace('<section class="section process-section"','</div><div class="dedicated-service-pathways"><div><span></span></div><div><span></span></div></div></div><section class="section process-section"');
  strong=strong.replace('<div class="about-copy">','<div class="about-composition"><div class="about-copy">').replace('<div class="pathways-grid">','</div><div class="pathways-grid">');
  strong=strong.replace('<div class="contact-details">','<div class="contact-composition"><div class="contact-details">').replace('<footer class="site-footer">','</div></div><footer class="site-footer">');
  const d=Mod.structuralDelta(baseline,strong);
  assert.equal(d.pass,true,JSON.stringify(d));
});
