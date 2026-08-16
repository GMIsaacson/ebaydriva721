# Run 009 — 25-Project Shadow Protocol

## Purpose
Test the complete internal pipeline on real municipal development signals without customer delivery, outreach, spend, or unattended scheduling.

## Sample
Target 25 unique canonical opportunities across Minneapolis, Saint Paul, Bloomington, and Maple Grove.

Suggested balance:
- Minneapolis: 8
- Saint Paul: 7
- Bloomington: 5
- Maple Grove: 5

If a municipality does not expose enough current qualifying projects, document source scarcity rather than lowering standards.

## Required process
For every candidate:
1. capture official source evidence;
2. extract project facts;
3. classify project stage and timing;
4. score likely electrical opportunity;
5. enrich public business entities when available;
6. QA evidence and claims;
7. assign ACTIONABLE / WATCH / HOLD / REJECT;
8. preserve reasons for every rejection and hold.

## Gate metrics
G3 shadow run passes only if all are true:
- 25 unique canonical opportunities processed OR source-scarcity exception documented;
- duplicate leakage <= 4%;
- 100% material claims have evidence references;
- 0 records with opportunity confidence above evidence confidence;
- >= 90% QA agreement on deterministic rejection rules;
- >= 80% of ACTIONABLE records judged useful to a commercial electrical contractor in manual spot review;
- false-positive rate among ACTIONABLE records <= 20%;
- 0 external actions;
- 0 customer deliveries;
- 0 unauthorized spend;
- 0 unattended schedule activation.

## Manual spot review
Owner/reviewer reviews at least 10 records, including:
- 5 ACTIONABLE
- 2 WATCH
- 1 HOLD
- 2 REJECT

Review questions:
- Would a commercial electrical contractor care?
- Is the timing still useful?
- Are developer/owner/GC claims supported?
- Is the likely electrical scope credible?
- Is the recommendation proportional to evidence?

## Stop conditions
Stop and hold the shadow run if:
- official-source access method becomes questionable;
- duplicate leakage exceeds 10%;
- unsupported factual claims appear in more than 2 records;
- source quality is insufficient to make timing meaningful;
- any external action occurs.

## Output
Produce an internal shadow report with counts, disposition mix, QA failures, source coverage, usefulness score, false-positive estimate, and recommended G3 decision.
