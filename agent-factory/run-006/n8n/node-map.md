# Run 006 G4 node map

| Order | Node | Input | Output | Side effects |
| --- | --- | --- | --- | --- |
| 1 | Manual Trigger Only | Human starts an isolated run | One execution | None |
| 2 | Load Synthetic Evidence | No external input | Fixed two-item test packet | None |
| 3 | Enforce G4 Policy | Test packet | Accepted or rejected policy result | None |
| 4 | Reconcile and Flag | Accepted structured evidence | Deduplicated records, exceptions and totals | None |
| 5 | Build Performance List | Internal result | Seven-unit performance list | None |
| 6 | Internal Subscription Result | Final internal packet | CLI/export evidence | None |

## Future credential map

No credentials are present or required at G4. A later, separately approved G5 shadow may use:

- Gmail read-only search and thread fetch.
- Notion read access to the Subscription Register.
- Notion draft/write access only after an explicit write approval and an idempotent upsert contract.

No credential may be embedded in the workflow JSON, fixtures, logs or Notion.

## Error routes

- Identity, authority, trigger or sensitive-data violation: stop with Review.
- Malformed evidence item: quarantine the item and require review.
- Duplicate event: suppress the second run.
- Duplicate evidence: retain provenance but propose only one record.
- Unknown downstream outcome: do not retry automatically.
