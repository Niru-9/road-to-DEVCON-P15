# Hand-off Evidence

Status: **SCHEMA + PROCEDURE (Phase 0).** No hand-off has happened yet. This file will
be updated with a real, observed rotation during the Phase 7 demo. Evidence is never
fabricated.

## Required artifact shape

```json
{
  "OLD_STEWARD": "0x...",
  "NEW_STEWARD": "0x...",
  "EVIDENCE": {
    "rootTopic": "0x...",
    "rootReference": "0x...",
    "feedIndexAfter": "…",
    "previousPublisher": "0x...",
    "timestamp": "2026-…"
  }
}
```

## Acceptable evidence forms (master plan §24)

- transaction hash / feed index
- signed message
- incoming identity address
- configuration before/after
- public feed state
- timestamped artifact

Two distinct identities must be visible (OLD vs NEW).

## Demo procedure (Phase 7)

1. Init: authority publishes root pointing at steward A; A publishes content.
2. Record `before` state: root feed index, current publisher.
3. `npm run handoff -- --incoming <steward B public key>` — authority rewrites root.
4. Record `after` state: root feed index (incremented), new publisher.
5. Reader resolves the **original** root identifier and finds B's content.
6. Fill the artifact above with the real values and commit.

## Integrity note

- The `feedIndexAfter` proves the root update happened on-chain (network-sequenced).
- `previousPublisher` ties the rotation to the actual prior steward.
- No local counter, database, or fabricated hash is involved.