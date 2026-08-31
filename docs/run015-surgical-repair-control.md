# Run 015 — Surgical Regression Repair Control

Work-control issue: #74

## Baseline rule

- Preserve the current best Run 015 near-pass artifact (92.0 overall; visual 91.8) as the intended immutable recovery baseline.
- Do not use either 83.4/REJECT repair descendant as a repair base.
- Before any UI mutation is committed, bind the repair policy to the exact preserved 92.0 artifact and record its full immutable hash.
- A score, screenshot, short hash prefix, source commit, or earlier Run 014 artifact is not sufficient proof of the Run 015 repair parent.

## Known lineage evidence

- Exact Run 014 Njia input branch: `preview/kenya-market-graph-20260831`.
- Exact Run 014 Njia input commit: `e06cc5c76d8c64d04f72df5e915c66508864c2fd`.
- Exact Run 014 input Vercel deployment: `dpl_C4sA2iueBa8bFSf9VbPmh3rDZV62`.
- Preserved Run 015 near-pass score: `92.0` overall; `91.8` visual.
- Preserved Run 015 artifact identifier available in historical evidence: prefix `39209fe6…` only.
- Full 64-character Run 015 near-pass artifact hash: **UNRECOVERED**.

The Run 014 input commit is not an authorized substitute for the missing Run 015 92.0 output. The incident-specific repair policy therefore remains intentionally unbound and must fail closed until the exact 92.0 artifact is recovered or a separately governed reconstruction creates and durably persists a new baseline.

## Permitted repair scope

Only these defects may be modified after baseline binding:

1. Desktop ledger header/value alignment.
2. Tablet decision-strip layout.
3. Keyboard/filter/ARIA behavior.

No typography redesign, spacing-system rewrite, component substitution, page restructuring, navigation redesign, branding changes, or unrelated cleanup is authorized.

## Non-regression gate

A candidate repair is rejected if any of the following occurs:

- its parent is not the policy-bound baseline artifact;
- overall score is below the current-best baseline;
- independent visual score is below the current-best baseline;
- any policy-required previously passing test becomes failing;
- any change lands outside the three factory-authorized repair surfaces;
- any scored dimension remains below 90;
- a failed repair descendant is used as the next repair base.

An equal-score repair does not replace the current best. Promotion requires every scored category >= 90, overall > 92.0, independent QA pass, and G4 pass.

## Artifact persistence rule

A Run 015 candidate may become `CURRENT_BEST` only after all of the following are durably recorded:

1. full artifact hash;
2. exact source revision and parent artifact hash;
3. complete UIX scorecard;
4. before/after viewport evidence references;
5. functional-check IDs and results;
6. independent QA decision;
7. immutable candidate location or branch/ref.

A REVISE loop may not begin from an in-memory or otherwise unaddressable candidate. Failed candidates remain evidence but never become the next repair parent.

## Repair lineage

- Intended preserved baseline full hash: **UNRECOVERED — policy deliberately unbound**.
- Failed 83.4 descendants: **MUST_NOT_BE_USED_AS_BASE**.
- Control branch: `run015/surgical-regression-repair`.
- Incident repair policy: `RUN015-NJIA-20260831`.

## Deployment rule

No deployment or production modification is authorized by this repair control change. Failed candidates are discarded from the repair lineage, and no Njia UI mutation may begin until an exact durable baseline is bound.
