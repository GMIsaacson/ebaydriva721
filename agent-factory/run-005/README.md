# Run 005 — Zero-Cost Controlled Notification Pilot

Run 005 is the Agent Team Factory's smallest controlled-live validation. It prepares one owner-approved Gmail message addressed only to the authenticated account, hands the typed packet to the approved Gmail executor, and records a single external send as G6 evidence.

## Contract

- Run ID: `FACT-NOTIFY-005`
- Workflow ID: `WF-FACT-NOTIFY-005-G6-001`
- Authority: Act with approval
- Trigger: one manual owner approval
- External action limit: exactly one self-addressed email
- Spending authority: $0
- AI calls: 0
- Schedule/webhook: none
- Attachments, links, CC, BCC and alternate recipients: prohibited
- Unknown send outcome: stop and request human review; never retry blindly

## Execution split

The inactive n8n workflow validates the fixed approval envelope and emits a typed `gmail.send_email` executor handoff. CI never sends mail and contains no Gmail credentials. The single live action is performed through the connected Gmail executor only after the approved preflight passes.

## Commands

```bash
npm run test:run005
npm run validate:run005
npm run preflight:run005
```

## Pass criteria

1. The fixed packet passes all authority checks.
2. Duplicate, altered-recipient, added-recipient, attachment, link, spending and retry-expansion fixtures are rejected or suppressed.
3. The inactive n8n workflow imports, executes, exports inactive and contains no credentials or external-action node.
4. Exactly one self-email is sent by the approved executor.
5. Gmail returns a message identifier and the result is linked from the Notion gate record.
6. Total incremental cost remains $0.

