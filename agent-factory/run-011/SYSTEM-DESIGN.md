# Run 011 PRR/RM Extension — System Design

## Objective

Add a permanent reasoning layer between signal detection and opportunity qualification so the Factory systematically searches both the value created by a signal and the pain created by it.

## Pipeline

```text
public / internal signal
  -> signal normalization
  -> PRR-001 pain inversion + reverse-business analysis
  -> RM-001 remedy mapping
  -> market-evidence package
  -> Factory-fit package
  -> SCOPE-GATE-001
  -> OPP-SCORE-001
  -> independent opportunity Q3
  -> Opportunity Registry
  -> BUILD / PROBE / WATCH / KILL decision by governed owner
```

## PRR-001 output contract

PRR-001 must identify:

- affected party;
- concrete pain;
- triggering mechanism;
- frequency/repetition;
- urgency;
- forward-value business;
- reverse-business hypothesis;
- evidence needed to falsify the hypothesis.

It may generate hypotheses but may not claim market validation.

## RM-001 output contract

RM-001 must identify:

- remedy classes (technical/legal/operational/informational);
- whether the remedy is actually available;
- jurisdiction/platform dependencies;
- authorization or consent requirements;
- automation path;
- non-removable/non-fixable residue;
- failure states and escalation path.

It may not infer legal entitlement without evidence or present legal mechanisms as guaranteed outcomes.

## Deterministic gates

`SCOPE-GATE-001` rejects sensitive uses that fall outside the approved opportunity-discovery scope.

`OPP-SCORE-001` uses nine weighted dimensions totaling 100 points. It never upgrades missing evidence into confidence. Missing evidence or missing kill criteria caps promotion at WATCH.

## Learning from misses

Every owner-discovered opportunity that the Factory should reasonably have surfaced becomes a `MISS-*` regression record containing:

- signal available at the time;
- prior Factory interpretation;
- owner insight;
- root cause of the miss;
- expected concept groups;
- calibration output;
- minimum score or decision expectation.

A regression failure blocks claims that opportunity-discovery improvements are working.

## Privacy calibration

The first regression case tests this transformation:

```text
people-search/data-broker aggregation
  -> affected person loses control over exposed personal information
  -> privacy-remediation pain
  -> consented exposure scan
  -> lawful opt-out/deletion/suppression/correction workflow
  -> verification
  -> recurring monitoring
```

The system is specifically prohibited from turning that signal into raw-person-profile resale, stalking/doxxing, minor targeting, or regulated eligibility decisioning.
