# Run 015 — Asteron G4 final acceptance

Issue: #78

## Locked artifact

- Commit: `d715f1d8fdc596c78192813ea07896b749fa67b0`
- Artifact: `public/asteron-uix015/index.html`
- Git blob: `5b4176f4f12669624cab0cb970bbd56731620e78`
- Deployment: `dpl_F7LB4a5BieisDKj3uhJgcaj7cbAX`
- Deployment state at acceptance: `READY`

The rendered source was source-locked before review: the 26,719-byte input recomputed to the exact Git blob above.

## Evidence

Viewport captures were made at 390×844, 820×1180 and 1440×1100. All three layouts rendered without horizontal overflow. Functional-equivalence checks passed for mobile menu visibility/open/escape-close, details toggling, evaluation boundary validation, invalid-state focus, valid local status, skip-link keyboard behavior, form labels and unique IDs.

Accessibility evidence also records semantic landmarks, visible-focus support, reduced-motion support, aria-live form status and contrast spot checks.

## UIX-100

| Dimension | Score |
| --- | ---: |
| Visual hierarchy | 94 |
| Typography | 91 |
| Layout & spacing | 93 |
| Component quality | 92 |
| UX clarity | 94 |
| Interaction polish | 90 |
| Responsive execution | 94 |
| Brand distinction | 93 |
| Accessibility | 92 |
| States & feedback | 90 |
| **Weighted UIX-100** | **92.6** |

Critical dimensions are all at or above 90. There are no critical blockers and functional equivalence passes.

## Independent QA decision

**PASS / PASS_PRODUCTION — 92.6**

The artifact is production-quality under the Run 015 acceptance rubric. No bounded repair surfaces are required. This decision qualifies the locked artifact only; it does not authorize a deployment, production mutation, or later UI descendant.

Domain-appropriateness and portfolio-similarity calibration are persisted separately and were not included in the weighted UIX score.
