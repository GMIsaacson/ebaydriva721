# Run 011 — Opportunity Intelligence / OUCS

Run 011 is the Factory's opportunity-search and synthesis capability. The live execution extension turns READY work into bounded public-source research rather than leaving it as a durable work order only.

## Live execution path

```
Agent 000 / Work Control
  -> Run 011 scheduled dispatcher
  -> deterministic public-source acquisition
  -> Opportunity Analyst reasoning call
  -> deterministic normalization + dedupe
  -> independent Reviewer reasoning call
  -> terminal candidate dispositions
  -> coverage/state persistence
  -> GitHub/Work Control progress receipt
```

The implementation reuses the proven Run 016 execution pattern:

- GitHub Actions is the scheduler/compute runner.
- GitHub OIDC authenticates the workflow to the Vercel inference bridge.
- Vercel AI Gateway supplies isolated reasoning calls.
- The bridge verifies that the selected models are currently tagged free and priced at zero before inference.
- Analyst and reviewer use different models.
- Evidence and state persist to `run011-live-evidence`.
- No outreach, spend, purchasing, publication, or deployment authority is granted to Run 011 research.

## Mission currently wired

Issue #110: U.S. Website Opportunity Census.

The coverage registry contains broad U.S. business territories. Each execution claims the next unprocessed bounded batch, gathers public evidence, produces candidate clusters, independently reviews them, writes terminal dispositions, updates coverage, and leaves the remaining frontier for the next run.

## Local deterministic checks

```bash
node --check api/run011-inference.js
node --check agent-factory/run-011/runtime/live-opportunity-census.cjs
node --test agent-factory/run-011/tests/*.test.cjs
```
