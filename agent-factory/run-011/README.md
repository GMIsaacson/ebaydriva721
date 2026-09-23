# Run 011 — Opportunity Intelligence / OUCS

Canonical Run ID: `OPPORTUNITY-INTELLIGENCE-011`

Status: **PRR/RM extension staged — deterministic regression PASS**

Run 011 owns opportunity discovery, decomposition, evidence packaging, routing and synthesis. This extension adds a mandatory **Pain & Remedy Radar** so the Factory does not only ask what can be done with a signal; it also asks who is hurt or inconvenienced by that signal and whether an executable remedy can become a business.

## New components

- `PRR-001` — Pain & Remedy Radar reasoning agent. Performs pain inversion and reverse-business analysis.
- `RM-001` — Remedy Mapper reasoning agent. Converts a pain hypothesis into lawful, technical and operational remedies.
- `OPP-SCORE-001` — deterministic 100-point opportunity scorer.
- `SCOPE-GATE-001` — fail-closed scope/safety gate for sensitive public-data opportunities.
- `MISS-REG-001` — missed-opportunity registry and regression harness.
- Existing independent opportunity Q3 remains the assurance gate; these new agents cannot self-approve.

## Mandatory reasoning operations

Every material signal must run:

1. **Forward value:** Who benefits because this exists?
2. **Pain inversion:** Who is harmed, inconvenienced or newly exposed because this exists?
3. **Reverse business:** What business becomes possible because the original business/technology exists?
4. **Remedy mapping:** Is there a lawful technical, legal, informational or operational remedy?
5. **Payment evidence:** Is there evidence that people already spend money or meaningful effort on the pain?
6. **Factory fit:** Can existing Factory capabilities deliver the remedy economically?
7. **Kill criteria:** What observation would invalidate the opportunity?
8. **Independent QA:** Evidence and score do not become `VALIDATED` without Q3.

## Decision thresholds

- `<55`: `KILL`
- `55–69.9`: `WATCH`
- `70–79.9`: `CONTROLLED_PROBE`
- `>=80`: `SERIOUS_INVESTIGATION`

A high score is capped at `WATCH` when evidence links or explicit kill criteria are missing.

## First regression case

`MISS-001` captures the Factory miss that triggered this upgrade: people-search/data-broker information was interpreted as an intelligence input, but the Factory failed to invert it into the consumer pain of unwanted exposure and the corresponding privacy-remediation business.

The calibration candidate **Personal Exposure Remediation / Privacy Removal Service** scores `81.5/100` with evidence present and therefore qualifies for `SERIOUS_INVESTIGATION` — not validation or launch.

## Verification

```bash
node --test agent-factory/run-011/tests/*.test.cjs
node agent-factory/run-011/runtime/regression-runner.cjs \
  agent-factory/run-011/registry/missed-opportunity-regressions.json
```

Current deterministic result: `6/6 PASS`; `MISS-001 PASS`.

## Authority boundary

This extension has zero authority to contact people, scrape restricted/private sources, buy data, send marketing, submit legal/privacy requests, deploy services, spend money, or perform destructive actions. Those require separate governed activation. Public-data opportunities involving stalking, doxxing, minors, raw personal-profile resale, or employment/tenant/credit/insurance eligibility decisioning fail closed.
