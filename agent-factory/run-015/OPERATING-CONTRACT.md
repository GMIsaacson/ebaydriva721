# Run 015 — UI Excellence Team Operating Contract

**Run:** UIX-015  
**Team:** UI Excellence Team  
**Lifecycle:** Testing / controlled G4 qualification  
**Current governance extension:** A0-UIX-015-002  
**Standing external authority:** None

## Mission
Take an existing working UI and improve its usability, visual hierarchy, typography, layout, interaction quality, responsive behavior, accessibility, consistency, perceived product quality, **niche appropriateness, and product-specific visual identity** without silently changing approved product logic.

The team is a shared specialist capability. It does not replace Software Product Engineering or the Website Business Team.

Run 015 must not converge on a reusable house style merely because that style scores well. The correct visual language must be derived from the product, audience, niche, tasks, brand position and current best-in-class evidence.

## Required workflow
1. **Intake lock** — identify the exact source/artifact, approved functional behavior, target users, constraints, forbidden changes, brand relationship to prior Factory products, and immutable parent evidence.
2. **Niche web research** — search the current public web for strong interfaces in the exact niche and relevant adjacent categories. Target **8–15** current references; require at least **8 usable references and 4 direct-niche references** unless Independent QA accepts a documented market-sparsity exception. Capture direct URLs and observation date.
3. **Competitive visual audit** — extract principles rather than screenshots alone. Record typography/font families where inspectable, type hierarchy, palette, layout/grid, spacing density, component grammar, geometry, data presentation, imagery/iconography, interaction patterns, mobile transformation, and the distinctive idea behind each reference. Copying is forbidden.
4. **Product personality definition** — state the intended product character, audience expectations, emotional register, information density, brand posture, accessibility constraints and visual anti-goals before palette or fonts are selected.
5. **UX diagnosis** — identify flow friction, hierarchy problems, navigation issues, cognitive load, weak states, and accessibility risks.
6. **Divergent art direction** — create at least **three meaningfully different directions**, each represented as a visual genome. The three directions must differ structurally across typography, palette family, geometry, density, layout archetype, component grammar, imagery/iconography, motion and data-visualization language; recolors of one system do not count.
7. **Portfolio similarity gate** — compare every proposed direction with the durable Run 015 visual-genome registry. Unexplained convergence with an unrelated Factory product fails closed to REVISE. Related products may intentionally share a system only when the relationship is explicit and independently accepted.
8. **Direction selection** — choose the direction with the strongest product/niche fit, not the direction most similar to prior Run 015 work. Persist the selection rationale and rejected alternatives.
9. **Design-system delta** — define tokens/components/states needed for consistency and reuse within this product. Do not import a default Run 015 palette, font stack or component grammar.
10. **Interaction specification** — define feedback, motion, focus, loading, empty, success, error, hover and pressed behavior.
11. **Frontend polish implementation** — modify only approved frontend surfaces and preserve functional contracts.
12. **Responsive/accessibility verification** — mobile, tablet, desktop, keyboard, touch, contrast, focus, readable type, semantics and reduced motion.
13. **Visual acceptance scoring** — create the UIX-100 scorecard with before/after evidence plus niche-appropriateness and portfolio-distinction calibration.
14. **Independent QA** — verify score, blockers, functionality, evidence, authority, benchmark quality, art-direction divergence and portfolio similarity. The implementer cannot approve its own work.
15. **Iterate or finish** — REVISE returns to the appropriate stage; only PASS_PRODUCTION or PASS_EXCEPTIONAL can reach delivery.

## Mandatory niche benchmark dossier
The benchmark dossier is invalid unless it contains:
- direct evidence URLs and observation timestamps;
- at least 8 usable references, normally 8–15;
- at least 4 direct-niche references unless a documented sparsity exception is independently accepted;
- typography/font observations, including actual family names when publicly inspectable;
- palette/color-strategy observations;
- layout/grid and density observations;
- component and geometry observations;
- data-presentation patterns where relevant;
- imagery/iconography treatment;
- interaction/state patterns;
- mobile/responsive transformation patterns;
- one sentence describing what makes each reference distinctive;
- explicit non-copying principles extracted for the assignment.

A list of links without visual analysis does not satisfy the benchmark stage.

## Visual genome
Every art direction and completed Run 015 product must persist a visual fingerprint using these dimensions:
- palette temperature;
- primary hue family;
- accent hue family;
- typography strategy;
- geometry/radius/rule language;
- information density;
- layout archetype;
- component grammar;
- imagery/iconography treatment;
- motion style;
- data-visualization language.

The registry is **memory, not a style library**. Prior fingerprints exist so the team can detect accidental repetition, not so it can reuse them by default.

### Divergence rule
At least three directions are required. No pair may be more than **55% genome-similar** unless the differing dimensions are demonstrably high-impact and Independent QA records why the alternatives remain genuinely distinct.

### Portfolio similarity rule
For an unrelated product, a selected direction with **>65% genome similarity** to a prior completed Run 015 product is an automatic **REVISE** unless Independent QA records a concrete niche, brand-family or functional reason why that convergence is appropriate. A generic claim such as “premium,” “professional,” “clean,” or “enterprise” is not sufficient justification.

## UIX-100 score
The weighted score remains unchanged to preserve comparability with prior Run 015 results.

| Dimension | Weight |
|---|---:|
| Visual hierarchy | 15 |
| Typography | 10 |
| Layout & spacing | 10 |
| Component quality | 10 |
| UX clarity | 15 |
| Interaction polish | 10 |
| Responsive execution | 10 |
| Brand distinction | 10 |
| Accessibility | 5 |
| States & feedback | 5 |

**Thresholds**
- `<85`: REJECT
- `85–91.9`: REVISE
- `92–95.9`: PASS_PRODUCTION
- `>=96`: PASS_EXCEPTIONAL

The original critical dimensions remain critical: Visual hierarchy, UX clarity, responsive execution and accessibility must each score **>=90**.

**Brand distinction is now also critical and must score >=90.**

Two non-weighted calibration gates are additionally mandatory:
- **Niche appropriateness >=90** — does the interface look and behave like an exceptional product for this audience and market rather than a generic Run 015 product?
- **Portfolio distinction >=90** — is it sufficiently independent from unrelated Factory outputs, taking the visual-genome comparison into account?

Failure of either calibration gate yields **REVISE or REJECT regardless of aggregate UIX-100**. Any unresolved critical blocker overrides the aggregate score and yields REJECT.

## Non-regression safeguard
This extension is additive. It may not weaken the pre-existing Run 015 contract.

Every assignment must still prove:
- exact parent/artifact lineage;
- approved functionality preserved;
- mobile/tablet/desktop before-and-after evidence;
- core flows and previously passing checks remain passing;
- no unauthorized backend/business-rule changes;
- no unresolved critical blocker;
- no self-approval;
- UIX-100 >=92 for production pass;
- every original critical dimension >=90;
- repair descendants do not silently replace a stronger baseline;
- independent QA;
- evidence and terminal receipt recorded.

A Run 015 team upgrade itself must retain all previous deterministic acceptance tests and add tests for every new gate. Existing passing tests may not be deleted, weakened or converted into advisory warnings as part of this extension.

## Definition of done
A UI assignment is not done because the code compiled, one desktop screenshot looks attractive, or the result resembles a previously successful Run 015 design. Delivery requires:
- approved functionality preserved;
- current niche benchmark dossier complete;
- product personality brief complete;
- three genuinely divergent art directions considered;
- portfolio similarity report complete;
- mobile/tablet/desktop before-and-after evidence;
- core flows tested;
- no unauthorized backend/business-rule changes;
- no unresolved critical blocker;
- independent QA;
- UIX-100 >=92;
- all critical dimensions >=90;
- niche appropriateness >=90;
- portfolio distinction >=90;
- evidence and terminal receipt recorded.

## Authority boundary
Run 015 may inspect approved artifacts, **read public web pages for benchmark research**, edit source on an approved workspace/branch, run local tests, create screenshots, and return change sets and recommendations. Read-only public research does not authorize login, account creation, scraping behind access controls, customer contact, purchasing, posting, publishing or any other external side effect.

Run 015 has no standing authority to deploy, publish, mutate production data, contact customers, spend money, change permissions, or perform destructive actions.
