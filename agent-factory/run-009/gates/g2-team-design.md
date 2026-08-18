# Run 009 — G2 Team Design & Handoff Validation

## Objective
Make the seven Run 009 agents operate as one deterministic, auditable pipeline before any 25-project shadow run.

## Closed-loop workflow
1. Source Scout
   - Input: approved municipal source universe.
   - Output: source record + candidate project pointer.
   - Rejects: unofficial reposts when an official source exists; inaccessible source with no verifiable evidence; duplicate source pointer.

2. Document Extraction Agent
   - Input: candidate source pointer.
   - Output: normalized project facts with evidence anchors.
   - Must distinguish explicit facts from inferred facts.
   - Rejects: no project location, no project type, or no development signal.

3. Project Intelligence Agent
   - Input: normalized project facts.
   - Output: stage, timing, developer/owner/GC when known, project scale, confidence.
   - Never invents missing entities.

4. Electrical Opportunity Analyst
   - Input: project intelligence record.
   - Output: electrical-opportunity score, likely scopes, timing relevance, disposition.
   - Uses scoring rubric only; no free-form override without reason code.

5. Entity Enrichment Agent
   - Input: project + known organizations.
   - Output: verified public business identities and public contact surfaces.
   - No personal-contact harvesting; no outreach.

6. Evidence & QA Agent
   - Input: enriched opportunity record.
   - Output: PASS / HOLD / REJECT + QA reasons.
   - Validates official evidence, duplicate status, confidence, and unsupported claims.

7. Delivery / Portfolio Agent
   - Input: QA-passed opportunity.
   - Output: internal portfolio record only during G2/G3.
   - No customer delivery, email, SMS, CRM write, or external publication.

## Canonical handoff requirements
Every handoff must include:
- runId = MUNI-INTEL-009
- opportunityId
- producerAgent
- source municipality
- source URL
- evidence timestamp
- evidence class (DIRECT / DERIVED)
- confidence 0-100
- claims[] with evidenceRef per material claim
- status
- rejection/hold reason codes when applicable

## Duplicate policy
Treat candidates as probable duplicates when at least two match:
- normalized street address / parcel
- development name
- developer + municipality
- municipal application/case identifier

When probable duplicate:
- preserve all evidence sources;
- merge into one canonical opportunity;
- never count as a new opportunity for gate metrics.

## Confidence calibration
- 90-100: key project facts directly stated in current official source; identity/timing materially corroborated.
- 75-89: project is directly evidenced; some secondary attributes are derived or incomplete.
- 60-74: plausible opportunity with meaningful missing facts; HOLD unless scoring threshold still supported by direct evidence.
- <60: REJECT from actionable portfolio.

No record may have opportunityConfidence > evidenceConfidence.

## Dispositions
- ACTIONABLE: score >= 70, confidence >= 75, current/forward-looking signal, QA PASS.
- WATCH: score 50-69 or timing not yet actionable, confidence >= 70.
- HOLD: missing material evidence or unresolved duplicate/entity conflict.
- REJECT: irrelevant, stale, unverifiable, residential-small-project noise, or score <50.

## Hard rejection rules
Reject when any applies:
- source is not within approved source universe and cannot be corroborated by an official source;
- project is outside pilot municipalities;
- project has no credible commercial/multifamily/institutional/industrial electrical scope;
- record is only a routine maintenance permit with no meaningful project signal;
- project is completed/occupied and no forward opportunity remains;
- material claims lack evidence anchors;
- candidate is a duplicate of an existing canonical opportunity.

## Authority
Observe, extract, classify, score, enrich public business information, QA, and create internal test records only.
External actions: 0.
Customer delivery: not authorized.
Outreach: not authorized.
Spend: not authorized.
Recurring unattended schedule: not authorized.
