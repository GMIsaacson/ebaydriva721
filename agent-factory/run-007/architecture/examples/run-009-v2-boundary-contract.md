# Run Boundary Contract — Run 009 Factory v2 Regression

**Contract ID:** B0-MUNI-INTEL-009
**Version:** 1.0
**Architecture ID / Version:** A0-MUNI-INTEL-001 v1.0
**Run ID:** MUNI-INTEL-009
**Owner:** Aberdeen
**Status:** PASS

## 1. Component mission
Convert approved public municipal development signals into evidence-backed canonical project intelligence and an initial electrical-opportunity assessment, then hand a versioned Canonical Project Package to downstream systems without owning commercialization, multi-trade expansion, or autonomous customer delivery.

## 2. Inputs
| Input | Upstream owner/system | Required fields/contract | Failure if absent |
|---|---|---|---|
| Official municipal/public source | Approved source registry | municipality, source URL, source class, observedAt | do not collect / WATCH only |
| Source document/page | Municipal Source Scout | source identity, content/evidence reference, fetch result | reject or human review |
| Approved pilot geography | A0/System Map | Minneapolis, Saint Paul, Bloomington, Maple Grove | fail closed outside scope |
| Evidence/authority policy | Run 008 + Run 009 policy | provenance, confidence, no-contact authority | block promotion/external action |

## 3. Outputs
| Output | Downstream consumer/system | Contract/version | Delivery trigger |
|---|---|---|---|
| Canonical Project Package | Canonical Project Store / Downstream Opportunity Team | CPP v1.0 | canonical QA threshold or governed WATCH handoff |
| Internal electrical opportunity assessment | Downstream Opportunity/Commercial Team | EOA v0.1 | evidence-backed project record available |
| Reject/remediation record | Team 1 / human review queue | QA v0.1 | missing, stale, contradictory, duplicate, or out-of-scope evidence |

## 4. In scope
- read-only discovery from approved municipal sources;
- extraction and evidence capture;
- canonicalization and duplicate suppression at intelligence layer;
- project-stage/type/scale normalization;
- initial electrical relevance/opportunity thesis;
- confidence and QA classification;
- production of Canonical Project Package for downstream use;
- bounded internal sample/report drafting.

## 5. Explicitly out of scope
- customer acquisition or autonomous outbound messaging;
- payments/subscriptions/pricing exceptions;
- unrestricted city, state, or national expansion;
- unrestricted trade/niche expansion;
- durable whole-business project graph ownership;
- customer-specific matching/delivery history;
- multi-trade commercialization;
- recurring production activation;
- purchases, paid data, credential/account changes, bidding, or destructive actions.

## 6. Canonical records / stores touched
| Record | Read | Write | System of record | Ownership note |
|---|---|---|---|---|
| Source registry | yes | bounded | source-controlled registry | Team 1 owns approved source config only |
| Source observation | yes | yes | future durable operational store | current runtime evidence is not final business store |
| Canonical project package | yes | yes | future Canonical Project Store | Team 1 produces; downstream system owns durable lifecycle |
| Customer profile/delivery | no | no | downstream commercialization system | explicitly outside Run 009 |
| Governance/gate evidence | yes | yes | Notion + source-control evidence | Factory/Run 007 governance |

## 7. Authority ceiling
- **Observe:** approved public municipal sources and existing internal records.
- **Draft/internal write:** project records, opportunity assessments, QA decisions, validation samples, internal prospect research.
- **Execute:** read-only source retrieval and deterministic internal processing within bounded controls.
- **Explicit approval required:** customer contact/delivery, recurring schedules, spend, paid sources, new cities/trades, pricing changes, production authority.
- **Never/self-authority prohibited:** self-expansion, self-approval, purchases, account/credential changes, destructive actions, autonomous bidding or customer commitments.

## 8. Completion condition
The Run is component-ready only when:
- approved source collection works across the pilot universe;
- provenance, confidence, duplicate and rejection controls pass;
- canonical records can be generated consistently;
- initial electrical-opportunity assessment passes QA;
- the CPP v1.0 handoff is defined;
- capability readiness is at least VALIDATION READY;
- downstream/business/production readiness are reported separately rather than implied.

## 9. Downstream handoff
- **Trigger:** canonical QA threshold or governed WATCH status suitable for downstream analysis.
- **Schema/version:** Canonical Project Package v1.0.
- **Minimum fields:** projectId, projectName, location, municipality, projectType, scale, currentStage, observedAt/freshness, evidenced parties, official evidence references, confidence, unresolved questions, lifecycle status, optional initial trade hypotheses.
- **Reject/remediation path:** return incomplete/contradictory/stale records to Team 1 or human review; downstream may not invent missing facts.
- **Duplicate/idempotency rule:** project identity/dedupe key must suppress duplicate downstream creation while retaining new evidence/events.
- **Provenance requirement:** material project claims retain official/public source anchors end-to-end.

## 10. Scope-change rule
Any material addition to owned responsibilities, external authority, canonical data ownership, geography, trade scope, customer behavior, or downstream delivery requires an Architecture Amendment and a new Boundary Contract version before implementation.

## 11. B0 decision
**PASS.**

Run 009 is explicitly Team 1: municipal/project intelligence plus initial electrical analysis. The broader business is not assigned to this Run.