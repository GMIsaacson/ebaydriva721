# Run 015 — Asteron lineage correction

## Correction

Run 015's real UI Excellence qualification artifact on 2026-08-31 is **Asteron**, not Njia / Kenya Market Graph.

A prior incident record incorrectly attributed an unpersisted 92.0 / 91.8 score and three supposed repair defects to Njia. Repository, deployment, and Factory evidence do not support that attribution. The Njia-specific repair policy and incident document are therefore removed. Generic non-regression controls remain part of Run 015.

## Exact Asteron artifact

- Branch: `preview/asteron-uix015-20260831`
- Initial preview commit: `5c61887246f8fa99e0b5941f99927431ebe655fd`
- Served preview commit: `e59dfdb70f865828a9efd5d1e70a2d938a7acf75`
- Current durable artifact commit: `d715f1d8fdc596c78192813ea07896b749fa67b0`
- Artifact path: `public/asteron-uix015/index.html`
- Immutable Git blob: `5b4176f4f12669624cab0cb970bbd56731620e78`
- Baseline provenance SHA-256: `39d3f33cb710bb55b083633d994110f65442fa2570f7d9c1ae3fcad18b572042`
- Vercel deployment: `dpl_F7LB4a5BieisDKj3uhJgcaj7cbAX`
- Preview URL: `https://datascout-live-sourcing-preview-npg63bmt7.vercel.app`

The durable baseline record is `agent-factory/run-015/evidence/asteron-g4-baseline.json`.

## Quality state

The durable artifact is recovered, but the repository does **not** contain a complete independent final G4 UIX-100 scorecard for it. Historical work included an initial 78.6 score, subsequent improvement into the mid-80s, strong domain-appropriateness evidence, and later similarity-calibration work; those intermediate observations must not be promoted into a fabricated final production-pass score.

Therefore:

- artifact identity: **VERIFIED / DURABLE**;
- final UIX-100 score: **PENDING**;
- production pass: **NOT ESTABLISHED**;
- current-best repair policy: **NOT YET BOUND**;
- further UI mutation: only after an independent scorecard identifies the actual repair scope.

## Generic regression controls retained

Run 015 keeps the useful controls introduced during the incident investigation:

1. a repair must identify the exact durable parent artifact;
2. a failed repair cannot silently become the next repair base;
3. an assignment-specific policy, not the candidate itself, defines permitted surfaces;
4. previously passing checks may not regress;
5. a near-pass/current-best artifact may not be displaced by a lower overall or visual score;
6. repair dimensions must meet the configured minimum;
7. equal-score candidates do not replace a current best.

These rules are artifact-agnostic. No live assignment policy is registered until its durable baseline and independent scorecard both exist.

## Next gate

Run 015 must perform independent G4 acceptance on the exact Asteron artifact above and persist:

- mobile/tablet/desktop viewport evidence;
- core functional-equivalence checks;
- complete UIX-100 dimension scores;
- accessibility and responsive findings;
- independent QA decision;
- precise repair surfaces if the result is REVISE;
- final terminal receipt.

Only after that evidence exists may a bounded repair policy be registered and a new Asteron candidate produced.
