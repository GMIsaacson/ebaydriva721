const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const fixtures = JSON.parse(fs.readFileSync(path.join(process.cwd(),'agent-factory','run-009','tests','g2-handoff-fixtures.json'),'utf8'));
const pilotMunicipalities = new Set(['Minneapolis','Saint Paul','Bloomington','Maple Grove']);

function classify(c) {
  if (!pilotMunicipalities.has(c.municipality)) return 'REJECT_GEOGRAPHY';
  if (!c.officialSource && !c.officialCorroboration) return 'REJECT_SOURCE';
  if (c.duplicateSignals >= 2) return 'HOLD_DUPLICATE_MERGE';
  if ((c.opportunityConfidence || 0) > (c.evidenceConfidence || 0)) return 'REJECT_CONFIDENCE_VIOLATION';
  if (!c.materialClaimsAnchored) return 'REJECT_UNANCHORED';
  if (c.projectType === 'routine_maintenance' || c.electricalScore < 50) return 'REJECT_NOISE';
  if (c.electricalScore >= 70 && c.opportunityConfidence >= 75 && c.forwardLooking) return 'ACTIONABLE';
  if (c.electricalScore >= 50 && c.opportunityConfidence >= 70) return 'WATCH';
  return 'HOLD';
}

test('all G2 adversarial fixtures produce expected dispositions', () => {
  for (const f of fixtures.fixtures) assert.equal(classify(f.candidate), f.expect, f.id);
});

test('Run 009 remains zero external authority at G2', () => {
  const design = fs.readFileSync(path.join(process.cwd(),'agent-factory','run-009','gates','g2-team-design.md'),'utf8');
  assert.match(design, /External actions: 0/);
  assert.match(design, /Customer delivery: not authorized/);
  assert.match(design, /Outreach: not authorized/);
  assert.match(design, /Recurring unattended schedule: not authorized/);
});

test('duplicate and evidence-confidence controls are explicit', () => {
  const design = fs.readFileSync(path.join(process.cwd(),'agent-factory','run-009','gates','g2-team-design.md'),'utf8');
  assert.match(design, /No record may have opportunityConfidence > evidenceConfidence/);
  assert.match(design, /never count as a new opportunity for gate metrics/);
});
