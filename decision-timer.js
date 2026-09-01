import { TIMER_SECONDS, calculateTotal, formatSeconds, buildReceipt } from './decision-timer-core.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const timerOutput = $('#timer');
const timerMode = $('#timer-mode');
const startButton = $('#start-timer');
const pauseButton = $('#pause-timer');
const resetButton = $('#reset-timer');
const optionA = $('#option-a');
const optionB = $('#option-b');
const totalAOutput = $('#total-a');
const totalBOutput = $('#total-b');
const choiceAName = $('#choice-a-name');
const choiceBName = $('#choice-b-name');
const prompt = $('#decision-prompt');
const receipt = $('#receipt');
const receiptText = $('#receipt-text');
const copyButton = $('#copy-receipt');
const copyStatus = $('#copy-status');
const choiceButtons = $$('.choice-button');

let remaining = TIMER_SECONDS;
let mode = 'idle';
let intervalId = null;
let latestTotals = { a: 0, b: 0 };

function readCriteria() {
  return $$('.criterion-row').map((row) => ({
    name: $('.criterion-name', row).value.trim(),
    weight: $('.weight', row).value,
    a: $('.score-a', row).value,
    b: $('.score-b', row).value,
  }));
}

function renderTotals() {
  const criteria = readCriteria();
  latestTotals = {
    a: calculateTotal(criteria, 'a'),
    b: calculateTotal(criteria, 'b'),
  };
  totalAOutput.textContent = String(latestTotals.a);
  totalBOutput.textContent = String(latestTotals.b);
  choiceAName.textContent = optionA.value.trim() || 'Option A';
  choiceBName.textContent = optionB.value.trim() || 'Option B';
}

function renderTimer() {
  timerOutput.textContent = formatSeconds(remaining);
  timerMode.textContent = mode === 'running' ? 'Running' : mode === 'paused' ? 'Paused' : mode === 'expired' ? 'Time' : 'Ready';
  startButton.disabled = mode === 'running' || mode === 'expired';
  pauseButton.disabled = mode !== 'running';
  startButton.textContent = mode === 'paused' ? 'Resume' : 'Start';
}

function setLocked(locked) {
  $$('[data-lockable]').forEach((control) => {
    control.disabled = locked;
    control.dataset.locked = String(locked);
  });
  choiceButtons.forEach((button) => { button.disabled = !locked; });
}

function expire() {
  clearInterval(intervalId);
  intervalId = null;
  remaining = 0;
  mode = 'expired';
  setLocked(true);
  renderTotals();
  renderTimer();
  prompt.textContent = 'Time. The comparison is locked. Make the call.';
  choiceButtons[0]?.focus();
}

function tick() {
  remaining = Math.max(0, remaining - 1);
  if (remaining === 0) expire();
  else renderTimer();
}

function startTimer() {
  if (mode === 'running' || mode === 'expired') return;
  mode = 'running';
  prompt.textContent = 'Clock running. Score quickly; do not add more criteria.';
  intervalId = window.setInterval(tick, 1000);
  renderTimer();
}

function pauseTimer() {
  if (mode !== 'running') return;
  clearInterval(intervalId);
  intervalId = null;
  mode = 'paused';
  prompt.textContent = 'Paused. Resume when you are ready to continue the same decision.';
  renderTimer();
}

function resetTimer() {
  clearInterval(intervalId);
  intervalId = null;
  remaining = TIMER_SECONDS;
  mode = 'idle';
  setLocked(false);
  receipt.hidden = true;
  receiptText.textContent = '';
  copyStatus.textContent = '';
  prompt.textContent = 'Start the timer when both options are ready.';
  renderTotals();
  renderTimer();
}

function recordChoice(choiceKey) {
  if (mode !== 'expired') return;
  renderTotals();
  receiptText.textContent = buildReceipt({
    choiceKey,
    optionA: optionA.value,
    optionB: optionB.value,
    totalA: latestTotals.a,
    totalB: latestTotals.b,
    timestamp: new Date(),
  });
  receipt.hidden = false;
  prompt.textContent = 'Decision recorded. Reset only if you are starting a genuinely new decision.';
  receipt.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
}

async function copyReceipt() {
  if (!receiptText.textContent) return;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(receiptText.textContent);
    copyStatus.textContent = 'Copied.';
  } catch {
    copyStatus.textContent = 'Copy unavailable — select the receipt text manually.';
  }
}

startButton.addEventListener('click', startTimer);
pauseButton.addEventListener('click', pauseTimer);
resetButton.addEventListener('click', resetTimer);
copyButton.addEventListener('click', copyReceipt);
choiceButtons.forEach((button) => button.addEventListener('click', () => recordChoice(button.dataset.choice)));
$$('[data-lockable]').forEach((control) => control.addEventListener('input', renderTotals));
$$('select[data-lockable]').forEach((control) => control.addEventListener('change', renderTotals));

renderTotals();
renderTimer();
