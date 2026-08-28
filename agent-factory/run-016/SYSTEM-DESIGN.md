# System design

## Operational loop

Trigger: an hourly condition watch, daily schedule, or owner-requested bounded scan after activation.

Outcome: a source-attributed urgent alert recommendation or comprehensive daily brief containing only new, material, sufficiently evidenced public technology developments.

End condition: every candidate reaches `URGENT_ALERT`, `DAILY_BRIEF`, `WATCHLIST`, `REJECT`, or `DEAD_LETTER`; independent QA and authority accounting are recorded; downstream handoffs are prepared without inferring acceptance.

Owner: Aberdeen Technologies.

## Control plane

The control plane owns run ids, schedules, source-batch limits, retries, cancellation, idempotency, policy versions, model and tool allowlists, budget ceilings, QA gates, dead letters, terminal receipts, and owner activation. Source content cannot modify it.

## Data plane

The data plane holds source captures, transcripts, normalized events, story clusters, evidence links, specialist analysis, scores, coverage reports, briefs, and alert candidates. Every durable record carries provenance and a content hash.

## Dependency boundary

Run016 prepares `technology_brief_package_v1` for PUB-ENG-009 and `ops_handoff_v1` for OPS-CORE-008. It cannot claim that either downstream run accepted, executed, published, notified, or monitored anything until that run records its own evidence.

## Single points of failure

- source acquisition: mitigate with source-family diversity and source-health telemetry;
- provenance evidence store: mitigate with immutable records and tested backup/restore before G6;
- model runtime: mitigate with structured contracts, model fallback qualification, and deterministic QA rules;
- owner activation gate: intentional safety bottleneck for external delivery and spend.

