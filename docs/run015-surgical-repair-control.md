# Run 015 — Surgical Regression Repair Control

Work-control issue: #74

## Baseline rule

- Preserve the current best Run 015 near-pass artifact (92.0 overall; visual 91.8) as immutable recovery baseline.
- Do not use either 83.4/REJECT repair descendant as a repair base.
- Before any UI mutation is committed, bind this branch to the exact preserved artifact/commit and record its full hash here.

## Permitted repair scope

Only these defects may be modified:

1. Desktop ledger header/value alignment.
2. Tablet decision-strip layout.
3. Keyboard/filter/ARIA behavior.

No typography redesign, spacing-system rewrite, component substitution, page restructuring, navigation redesign, branding changes, or unrelated cleanup is authorized.

## Non-regression gate

A candidate repair is rejected if any of the following occurs:

- overall score < 92.0;
- visual score < 91.8;
- any previously passing test becomes failing;
- any change lands outside the three permitted repair surfaces;
- the repair is based on a failed repair descendant rather than the preserved baseline.

Promotion requires all scored categories >= 90, overall > 92.0, independent QA pass, and G4 pass.

## Repair lineage

- Preserved baseline full hash: TO_BE_BOUND_FROM_RUN015_EVIDENCE
- Failed descendants: MUST_NOT_BE_USED_AS_BASE
- Repair branch: `run015/surgical-regression-repair`

## Deployment rule

No deployment or production modification is authorized by this repair. Failed candidates are discarded and the baseline remains the recovery point.
