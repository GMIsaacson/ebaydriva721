# Factory UI Registry Policy v1

Date: 2026-09-16

## Purpose

Factory interfaces are durable operational assets. A UI is not considered released until it has a registry record and a retrievable launch/manage path.

## Canonical record

`agent-factory/governance/ui-registry-v1.json` is the curated source of truth for UI assets. Vercel project inventory is the discovery layer; the registry adds meaning, ownership, lifecycle, links and attention state.

Every record must include:

- permanent `id`
- display `name`
- `family`
- `description`
- `platform`
- `lifecycle`: `ACTIVE`, `PROTOTYPE`, or `ARCHIVE`
- `health`: `READY`, `DISCOVERED`, or `ATTENTION`
- `launchUrl`
- `urlConfidence`: `VERIFIED`, `VERIFIED_DEPLOYMENT`, or `INFERRED`
- hosting/project identifier when available
- repository and branch when known
- deployment mode
- accountable owner/team
- tags
- notes / attention reason

## Release gate

A Factory work order that creates or materially replaces a UI is incomplete until:

1. the UI has a registry record;
2. the production/preview URL is recorded;
3. the owner and project family are recorded;
4. deployment mode is recorded;
5. the UI is visible in `/factory-control/ui-hub`;
6. obsolete predecessors are marked `ARCHIVE` or `ATTENTION` rather than silently forgotten.

## Discovery and reconciliation

Vercel project inventory should be reconciled against the registry periodically. Any Vercel project without a registry row is an **unregistered UI asset** and must surface as attention work.

For non-Vercel interfaces (n8n, DigitalOcean, Firebase, internal/local tools), add a normal registry record with the appropriate `platform`. The registry is platform-neutral even though v1 is seeded from Vercel.

## No destructive deletion

Do not delete old UI records just because a newer interface exists. Mark them `ARCHIVE` and state what superseded them. This preserves lineage and prevents repeat work.

## Pinning

The canonical registry contains default pins for high-value interfaces. The UI Hub may layer per-browser pin preferences over those defaults without altering the canonical record.

## Current v1 objective

Make Factory Control the permanent front door:

`Factory Control -> UI Hub -> any registered interface`

The operator should not need to remember a Vercel project name, old chat, branch, or deployment URL to recover a UI.
