# Factory Investment Office — Firebase System of Record v1.1

## Canonical root

`factoryInvestmentOfficeV1/public`

The public scope contains non-sensitive research state that may be rendered by the FIO preview. Portfolio balances, account identifiers and actual trade instructions must never be stored in this public scope.

## Collections

### `assets/{ticker}`
Ranked watchlist / approved research universe.

Required fields: `ticker`, `name`, `rank`, `score`, `status`, `confidence`, `thesis`, `updatedAt`.

Optional fields: `horizon`, `targetWeight`, `dca`, `marketFeed`, `memoId`, `lastPrice`, `marketCap`, `expectedReturn`, `nextReviewAt`.

### `memos/{ticker}`
Living investment memo.

Required fields: `ticker`, `decision`, `score`, `confidence`, `thesis`, `bull`, `bear`, `kill`, `updatedAt`.

Every update must be traceable to a completed committee run and evidence set.

### `evidence/{evidenceId}`
Immutable evidence ledger.

Required fields: `assetId`, `source`, `sourceUrl`, `sourceType`, `claim`, `publishedAt`, `capturedAt`, `agent`, `confidence`.

Primary-source evidence should be preferred. Evidence records are append-only; corrections create a new record linked through `supersedes`.

### `queue/{workOrderId}`
Research work queue.

Required fields: `asset`, `owner`, `stage`, `next`, `priority`, `status`, `createdAt`, `updatedAt`.

### `runs/{runId}`
One record per FIO workflow execution.

Required fields: `workflow`, `status`, `startedAt`, `completedAt`, `summary`, `evidenceCount`, `qa`.

Canonical workflow names: `FIO-MONITOR`, `FIO-DAILY`, `FIO-RADAR`, `FIO-COMMITTEE`.

### `opportunities/{opportunityId}`
Opportunity Radar survivors only. Do not persist every cheap-screen reject here; rejects may be kept in a lower-cost archive if needed.

Required fields: `ticker`, `name`, `score`, `confidence`, `thesis`, `stage`, `discoveredAt`, `sourceRunId`.

### `alerts/{alertId}`
Material-change alerts.

Required fields: `asset`, `severity`, `title`, `summary`, `recommendation`, `createdAt`, `sourceRunId`, `ownerActionRequired`.

### `agents/{agentId}`
Operational state of INV-000 through INV-07.

Required fields: `name`, `role`, `state`, `lastRunAt`, `lastResult`.

### `decisions/{decisionId}`
INV-000 committee decisions. Append-only.

Required fields: `asset`, `decision`, `score`, `confidence`, `rationale`, `dissent`, `runId`, `createdAt`.

### `approvals/{approvalId}`
Owner approval requests. This does **not** execute a trade.

Required fields: `asset`, `requestedAction`, `rationale`, `status`, `createdAt`, `resolvedAt`.

Allowed status values: `WAITING_OWNER`, `APPROVED_FOR_REVIEW`, `REJECTED`, `EXPIRED`.

## Root metadata fields

The document `factoryInvestmentOfficeV1/public` stores:

- `version`
- `systemState`
- `autonomy = RESEARCH_ONLY`
- `tradeExecution = DISABLED`
- `lastMonitorRun`
- `lastDailyRun`
- `lastRadarRun`
- `lastCommitteeRun`
- `updatedAt`

## Security model

1. Browser clients are read-only.
2. n8n writes with a dedicated Firebase/Google service account.
3. The service account must be restricted to this project and used only inside n8n credentials/secrets.
4. Actual brokerage credentials are out of scope for FIO v1.
5. FIO may create approval requests but may not submit orders.

## QA invariant

No memo decision may advance to `ACCUMULATE`, `REDUCE`, or `EXIT` unless the originating committee run contains:

- Q1 operational/calculation result
- Q2 evidence/provenance result
- Q3 professional-excellence result
- INV-03 dissent/red-team output
- INV-000 synthesis

A failed required gate leaves the asset in `RESEARCH`, `WATCH`, or `REVIEW`.
