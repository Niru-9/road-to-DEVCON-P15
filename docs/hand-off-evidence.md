# Hand-off Evidence

Status: **COMPLETED.** A real A → B hand-off has been performed on the live local
Bee node and recorded in `docs/hand-off-evidence.json` (tracked). The artifact is
written by the live succession test (`tests/live/succession.live.test.ts`) after
a verified transfer — evidence is never fabricated. A run-record
(`docs/handoff-run.json`) captures the generated identities at run start.

## Required artifact shape

The tracked `docs/hand-off-evidence.json` follows this shape (the mkdocs schema
kept for compatibility):

```json
{
  "OLD_STEWARD": "0x...",
  "NEW_STEWARD": "0x...",
  "EVIDENCE": {
    "rootTopic": "…",
    "rootReference": "0x...",
    "feedIndexAfter": "…",
    "previousPublisher": "0x...",
    "timestamp": "2026-…"
  }
}
```

## Recorded hand-off (verified)

- `previousPublisher` (OLD_STEWARD): the real steward A public identity, as signed on
  the content feed before the hand-off.
- `nextPublisher` (NEW_STEWARD): the real incoming steward B public identity, distinct
  from A.
- `authorityOwner`: the succession authority identity that signed the root feed write.
- `rootTopic` / `contentTopic`: the stable reader entrypoint topic and the carried-over
  content topic actually used on-chain.
- `feedIndexAfter`: the root feed index observed immediately after the transfer write
  (network-sequenced).
- `nonceAfter`: the pointer nonce after rotation.
- `timestamp`: when the hand-off evidence was produced.
- `entrypoint.verified: true`: a reader resolving the SAME stable (`authorityOwner`,
  `rootTopic`) entrypoint obtained NEW_STEWARD's content after the transfer.

## Acceptable evidence forms (master plan §24)

- transaction hash / feed index
- signed message
- incoming identity address
- configuration before/after
- public feed state
- timestamped artifact

Two distinct identities must be visible (OLD vs NEW).

## Demo procedure

1. Init: authority publishes root pointing at steward A; A publishes content.
2. Record `before` state: root feed index, current publisher.
3. Authority rewrites root to steward B via `transferPublisher(incoming)`.
4. Record `after` state: root feed index (incremented), new publisher.
5. Reader resolves the **original** root identifier and finds B's content.
6. The real values are persisted to `docs/hand-off-evidence.json`.

## Integrity note

- The `feedIndexAfter` proves the root update happened on-chain (network-sequenced).
- `previousPublisher` ties the rotation to the actual prior steward.
- No local counter, database, or fabricated hash is involved.