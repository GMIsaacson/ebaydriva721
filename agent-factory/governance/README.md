# A0 Constitutional Lock

A0 is the mandatory architecture-discovery gate for structural Factory changes.

## Fail-closed rule

A protected structural change is blocked unless the same change set contains a valid current A0 decision record with `status: PASS`, a creation-capable verdict (`NEW` or `EXTEND`), reuse evidence, and path coverage for the proposed structure.

A prior approval is not inherited: the covering `.a0.json` decision must be added or updated in the same change set.

## Protected changes

The guard covers, at minimum:

- a new `agent-factory/run-NNN/` root;
- new or changed structural artifacts under agents, teams, units, workflows, n8n, contracts, registries, databases, services, and control-center directories;
- structural filenames containing agent, team, workflow, registry, topology, boundary, contract, control center, database, or service markers.

Tests, fixtures, examples, governance files, and GitHub CI workflow files are excluded from structural detection so the guard can be tested and maintained without self-deadlock.

## Required A0 decision evidence

Copy `a0-decision.template.json` into `agent-factory/governance/a0-decisions/<decision-id>.a0.json` and complete every field. For structural creation, `REUSE` and `REJECT` are intentionally non-authorizing verdicts.

Required evidence includes:

- measurable business outcome / ownership gap;
- existing owner and capability scan;
- reuse candidates checked;
- duplication analysis;
- exact residual unowned loop;
- owner and decision date;
- canonical evidence reference;
- exact repository paths covered by the decision.

## CI behavior

`.github/workflows/a0-constitutional-guard.yml` runs the guard on pull requests to `master`. A violation exits non-zero with `A0 BLOCK` and lists every unapproved structural path.

To make the lock non-bypassable at merge time, repository branch rules must require the `A0 Constitutional Guard / a0-guard` status check for `master` and prevent direct pushes/bypass for ordinary changes.
