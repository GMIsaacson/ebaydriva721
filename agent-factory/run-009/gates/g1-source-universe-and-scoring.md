# Run 009 — G1 Source Universe & Electrical Opportunity Scoring

## Pilot geography
Start with four municipalities to prove the pattern before expanding:

1. **Minneapolis**
   - City Planning Commission agendas/minutes (LIMS)
   - Planning & Zoning active applications / land-use resources
   - Development Review / construction permit resources

2. **Saint Paul**
   - Planning Commission meetings, agendas, packets, and documents
   - Planning / zoning materials surfaced through official city pages

3. **Bloomington**
   - Planning Commission agendas/webcasts/documents
   - Planning application portal/process and Development Review materials

4. **Maple Grove**
   - Planning Commission Agenda Center: agenda, packet, minutes
   - City Council Agenda Center where planning items advance
   - New-development / planning / zoning application resources

## Source policy
Tier A — authoritative municipal sources:
- planning commission agendas and packets
- city council agendas/packets for development approvals
- planning/zoning applications
- building/development permit records where publicly accessible
- official staff reports and public notices

Tier B — corroboration only:
- developer/architect/GC websites
- commercial real-estate announcements
- reputable local business press

Tier C — discovery only, never sole evidence:
- aggregators
- social media
- search snippets

A QA-passing project requires at least one Tier A source.

## Access rules
- Use public pages and documents only during G1–G4.
- Respect published access restrictions, robots/rate limits, and terms.
- Prefer feeds, APIs, agenda HTML, and structured endpoints where available over brittle scraping.
- Do not bypass logins, CAPTCHAs, paywalls, or technical access controls.
- Do not retain unnecessary personal information from public hearing records.

## Electrical opportunity score (100 points)

### A. Project value/scale — 25
- 0: trivial/residential-only/no material construction
- 10: small commercial alteration/addition
- 18: meaningful commercial build/redevelopment
- 25: large multifamily, industrial, institutional, hospitality, mixed-use, major retail/office

### B. Timing/actionability — 20
- 0: stale/completed
- 8: early concept with weak timing
- 14: active application/planning review
- 20: approved / permit / preconstruction where trade positioning is timely

### C. Electrical scope likelihood — 25
- 0: negligible
- 10: modest lighting/service work
- 18: substantial lighting/distribution/fire alarm/low voltage/site work
- 25: broad electrical package with multiple likely scopes

### D. Entity/contactability — 10
- 0: no evidenced responsible entity
- 5: owner/developer identified
- 10: developer/owner plus architect or GC/business channel identified

### E. Evidence quality — 15
- 0: unsupported
- 8: one authoritative source with basic facts
- 12: authoritative source with staff/application details
- 15: multiple corroborating sources or detailed official packet

### F. Freshness — 5
- 0: >180 days without update
- 2: 61–180 days
- 4: 15–60 days
- 5: <=14 days

## Classification
- **80–100: A — Actionable now**
- **70–79: B — Watch / likely valuable**
- **55–69: C — Research queue**
- **<55: Reject from customer feed**

Separate from this 100-point score, the canonical confidence field must still be >=0.75 for QA PASS.

## G1 acceptance criteria
G1 passes when:
1. four-municipality source universe is documented;
2. source tiers and access rules are explicit;
3. project schema is fixed at v0.1;
4. electrical score/ranking rules are explicit;
5. a manual evidence sample demonstrates at least 3 structurally valid candidate records from official sources;
6. zero external actions and zero paid data are used.
