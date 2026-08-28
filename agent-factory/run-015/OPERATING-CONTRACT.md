# Run 015 — UI Excellence Team Operating Contract

**Run:** UIX-015  
**Team:** UI Excellence Team  
**Lifecycle:** Testing  
**Current gate:** G4 ready; G3 deterministic acceptance passed 14/14  
**Standing external authority:** None

## Mission
Take an existing working UI and improve its usability, visual hierarchy, typography, layout, interaction quality, responsive behavior, accessibility, consistency, and perceived product quality without silently changing the approved product logic.

The team is a shared specialist capability. It does not replace Software Product Engineering or the Website Business Team.

## Required workflow
1. **Intake lock** — identify the exact source/artifact, approved functional behavior, target users, constraints, and forbidden changes.
2. **Benchmark** — inspect relevant best-in-class patterns. Learn principles; do not clone another product.
3. **UX diagnosis** — identify flow friction, hierarchy problems, navigation issues, cognitive load, weak states, and accessibility risks.
4. **Art direction** — choose a coherent product-specific visual language rather than applying a generic template.
5. **Design-system delta** — define tokens/components/states needed for consistency and reuse.
6. **Interaction specification** — define feedback, motion, focus, loading, empty, success, and error behavior.
7. **Frontend polish implementation** — modify only approved frontend surfaces and preserve functional contracts.
8. **Responsive/accessibility verification** — mobile, tablet, desktop, keyboard, touch, contrast, focus, semantics, reduced motion.
9. **Visual acceptance scoring** — create the UIX-100 scorecard with before/after evidence.
10. **Independent QA** — verify score, blockers, functionality, evidence, and authority. The implementer cannot approve its own work.
11. **Iterate or finish** — REVISE returns to the appropriate stage; only PASS_PRODUCTION or PASS_EXCEPTIONAL can reach delivery.

## UIX-100 score
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

Visual hierarchy, UX clarity, responsive execution, and accessibility must each score **>=90**. Any unresolved critical blocker overrides the aggregate score and yields REJECT.

## Definition of done
A UI assignment is not done because the code compiled or one desktop screenshot looks attractive. Delivery requires:
- approved functionality preserved;
- mobile/tablet/desktop before-and-after evidence;
- core flows tested;
- no unauthorized backend/business-rule changes;
- no unresolved critical blocker;
- independent QA;
- UIX-100 >=92;
- all critical dimensions >=90;
- evidence and terminal receipt recorded.

## Authority boundary
Run 015 may inspect approved artifacts, edit source on an approved workspace/branch, run local tests, create screenshots, and return change sets and recommendations. It has no standing authority to deploy, publish, mutate production data, contact customers, spend money, change permissions, or perform destructive actions.
