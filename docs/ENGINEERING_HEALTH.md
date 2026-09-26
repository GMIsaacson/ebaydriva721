# Factory Engineering Health V1 — implementation contract

Parent: GMIsaacson/Eb-Al#60. Owning issue: GMIsaacson/ebaydriva721#130.

This is a **read-only preview feature** on the existing Factory Control integration stack, not a deployed release or a second system of record. Route: `/factory-control/engineering`. Endpoint: `GET /api/engineering-health`.

Security: Firebase signature/audience/expiration verification reused from n8n-control, then positive owner claim from the existing Work Control owner endpoint. Server-only `SOURCEMARGIN_GITHUB_TOKEN` (or `GITHUB_TOKEN`) needs read access to all three repositories; never expose it in client-side config. Missing credentials and owner-check errors fail closed. GitHub API polling is manual refresh, without client token or automatic GitHub writes.

Data: current GitHub PRs/issues; 400-item per-repository retrieval cap surfaced as truncation; up to twelve new active PRs per repository get detailed reviews/check-runs; missing CI = UNVERIFIED. Customer legacy PRs #8–53 and Factory feature-base PRs are separated from active queue. Counts for regressions/debt only reflect correctly tagged issues. Deployment, code coverage and canonical Work Control evidence are **not** inferred from GitHub state.

Cadence: continuous PR CI/review; weekday GitHub triage (scheduled using the existing SourceMargin improvement review), Friday deeper review; monthly architecture/security audit is policy, not an installed scheduler. PR first review goal 24h; new active non-draft PR age 3d escalate, 5d reconcile. Historical backlog is protected pending issue sourcemargin1.0#54.

Release gates: independent reviewer/security test; `node --test agent-factory/run-004/tests/engineering-health-model.test.cjs`; project build; verify signed-out, signed-in non-owner, missing token and partial GitHub outages; configure Vercel secret; preview owner read; reconcile Factory PR #129 and its parent before rebase/merge. Only after deployment, smoke and rollback evidence close #130. No automatic merge, close, deployment or runtime mutation.
