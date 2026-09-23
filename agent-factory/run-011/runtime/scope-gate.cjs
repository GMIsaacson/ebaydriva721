'use strict';

const INTENT_KEYS = /purpose|product|business|proposed|offer|action|workflow|useCase|use_case|candidate|service/i;
const EVIDENCE_KEYS = /signal|source|evidence|priorFactoryInterpretation|marketEvidence|citation/i;

function collectIntent(value, key = '') {
  if (value == null) return [];
  if (typeof value === 'string') return INTENT_KEYS.test(key) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((item) => collectIntent(item, key));
  if (typeof value !== 'object') return [];

  const out = [];
  for (const [childKey, childValue] of Object.entries(value)) {
    if (EVIDENCE_KEYS.test(childKey)) continue;
    if (typeof childValue === 'string' && INTENT_KEYS.test(childKey)) out.push(childValue);
    else if (typeof childValue === 'object' && childValue !== null) out.push(...collectIntent(childValue, childKey));
  }
  return out;
}

function scopeGate(packet) {
  const intentParts = collectIntent(packet);
  const intentText = intentParts.join(' | ');
  const violations = [];

  if (/(sell|resell|monetize|broker)\b/i.test(intentText) && /(personal data|person profiles?|home addresses?|people records?|relatives)/i.test(intentText)) {
    violations.push('RAW_PERSON_PROFILE_RESALE');
  }
  if (/(employment|tenant|credit|insurance|eligibility|background check)/i.test(intentText)) {
    violations.push('ELIGIBILITY_DECISIONING');
  }
  if (/(stalk|doxx?|harass|track a person|locate a person)/i.test(intentText)) {
    violations.push('STALKING_DOXXING');
  }
  if (/(target|profile|locate|contact).{0,30}(minor|child|children|under 18)/i.test(intentText)) {
    violations.push('MINOR_TARGETING');
  }

  return {
    pass: violations.length === 0,
    violations,
    allowedPrivacyPattern: /privacy|remov|delete|opt.?out|suppress|monitor/i.test(intentText),
    evaluatedIntent: intentText,
  };
}

module.exports = { scopeGate, collectIntent };
