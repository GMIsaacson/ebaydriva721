'use strict';

(function () {
  const scorer = globalThis.OpportunityScore;
  if (!scorer) throw new Error('OpportunityScore module is required');

  const SAMPLE = Object.freeze({ demand: 8, speed: 7, margin: 8, automation: 9, advantage: 5 });
  const ids = Object.keys(SAMPLE);
  const elements = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));
  const outputs = Object.fromEntries(ids.map((id) => [id, document.getElementById(`${id}-output`)]));
  const nameInput = document.getElementById('opportunity-name');
  const opportunityLabel = document.getElementById('opportunity-label');
  const scoreEl = document.getElementById('score');
  const decisionEl = document.getElementById('decision');
  const rationaleEl = document.getElementById('rationale');
  const resetButton = document.getElementById('reset');

  const required = [nameInput, opportunityLabel, scoreEl, decisionEl, rationaleEl, resetButton, ...Object.values(elements), ...Object.values(outputs)];
  if (required.some((element) => !element)) throw new Error('Required UI element missing');

  function currentValues() {
    return Object.fromEntries(ids.map((id) => [id, Number(elements[id].value)]));
  }

  function render() {
    const result = scorer.scoreOpportunity(currentValues());
    for (const id of ids) outputs[id].textContent = String(result.values[id]);

    const name = nameInput.value.trim() || 'Untitled opportunity';
    opportunityLabel.textContent = name;
    scoreEl.textContent = String(result.score);
    decisionEl.textContent = result.decision;
    decisionEl.dataset.decision = result.decision;
    rationaleEl.textContent = result.rationale;
  }

  function reset() {
    for (const id of ids) elements[id].value = String(SAMPLE[id]);
    nameInput.value = 'Managed missed-call recovery';
    render();
    nameInput.focus();
  }

  for (const id of ids) elements[id].addEventListener('input', render);
  nameInput.addEventListener('input', render);
  resetButton.addEventListener('click', reset);
  render();
})();
