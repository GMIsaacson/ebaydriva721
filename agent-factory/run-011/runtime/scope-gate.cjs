'use strict';

const PROHIBITED = [
  { code: 'RAW_PERSON_PROFILE_RESALE', re: /sell|resell|broker/i, context: /personal data|person profile|home address|relatives/i },
  { code: 'ELIGIBILITY_DECISIONING', re: /employment|tenant|credit|insurance|eligibility|background check/i },
  { code: 'STALKING_D0XXING', re: /stalk|dox|harass|track a person|locate a person/i },
  { code: 'MINOR_TARGETING', re: /minor|child|children|under 18/i },
];

function scopeGate(packet) {
  const text = JSON.stringify(packet || {});
  const violations = [];
  for (const rule of PROHIBITED) {
    if (rule.code === 'RAW_PERSON_PROFILE_RESALE') {
      if (rule.re.test(text) && rule.context.test(text)) violations.push(rule.code);
    } else if (rule.re.test(text)) {
      violations.push(rule.code);
    }
  }
  return {
    pass: violations.length === 0,
    violations,
    allowedPrivacyPattern: /privacy|remov|delete|opt.?out|suppress|monitor/i.test(text),
  };
}

module.exports = { scopeGate };
