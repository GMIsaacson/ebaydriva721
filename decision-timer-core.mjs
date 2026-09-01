export const TIMER_SECONDS = 180;

export function asBoundedNumber(value, min = 0, max = 5) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

export function calculateTotal(criteria, scoreKey) {
  if (!Array.isArray(criteria)) return 0;
  return criteria.reduce((total, criterion) => {
    const weight = asBoundedNumber(criterion.weight, 0, 5);
    const score = asBoundedNumber(criterion[scoreKey], 1, 5);
    return total + weight * score;
  }, 0);
}

export function formatSeconds(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function decisionRationale(choiceKey, totalA, totalB) {
  const a = Number(totalA) || 0;
  const b = Number(totalB) || 0;
  if (a === b) return 'The weighted totals were tied; the final call came from judgment.';
  const selected = choiceKey === 'a' ? a : b;
  const other = choiceKey === 'a' ? b : a;
  const delta = Math.abs(selected - other);
  return selected > other
    ? `The selected option led the weighted score by ${delta} point${delta === 1 ? '' : 's'}.`
    : `You chose against the weighted score by ${delta} point${delta === 1 ? '' : 's'} — an explicit judgment call.`;
}

export function buildReceipt({ choiceKey, optionA, optionB, totalA, totalB, timestamp }) {
  const nameA = String(optionA || '').trim() || 'Option A';
  const nameB = String(optionB || '').trim() || 'Option B';
  const selected = choiceKey === 'a' ? nameA : nameB;
  const when = timestamp instanceof Date ? timestamp : new Date(timestamp || Date.now());
  return [
    'DECISION TIMER / RECEIPT',
    `Decision: ${selected}`,
    `Option A — ${nameA}: ${Number(totalA) || 0}`,
    `Option B — ${nameB}: ${Number(totalB) || 0}`,
    `Rationale: ${decisionRationale(choiceKey, totalA, totalB)}`,
    `Recorded: ${when.toISOString()}`,
  ].join('\n');
}
