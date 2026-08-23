# software_spec_v1 — Opportunity Quick Score

## Functional behavior

The application accepts an opportunity name plus five integer scores from 1–10:

- Demand — 30% weight
- Speed to cash — 25%
- Margin potential — 20%
- Automation fit — 15%
- Competition advantage — 10%

Weighted score = weighted average × 10, rounded to nearest integer.

Decision thresholds:

- 75–100: BUILD
- 55–74: VALIDATE
- 0–54: KILL

The UI must show the total score, recommendation, and a short rationale naming the strongest and weakest dimensions. Input changes recalculate immediately. Reset returns to the sample values 8, 7, 8, 9, 5.

## Non-functional requirements

- Static HTML/CSS/JavaScript only.
- No fetch/XHR/WebSocket calls.
- No cookies, localStorage, analytics, third-party scripts, dependencies, or secrets.
- Keyboard-accessible form controls and visible focus states.
- Mobile-responsive layout.
- Scoring logic must be isolated in a pure module and covered by deterministic tests.

## Acceptance traceability

AC1 five dimensions → form controls in `index.html`.
AC2 deterministic weighted score → `score.js` + unit tests.
AC3 thresholds → `score.js` + boundary tests.
AC4 competition positive → weight model + test.
AC5 immediate recalculation → `app.js` input listeners.
AC6 reset → reset button + sample state.
AC7 accessibility → labels, output regions, focus styles.
AC8 no network/dependencies → static architecture + source scan test.
