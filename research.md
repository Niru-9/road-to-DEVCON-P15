# Research — Problem 3 (The Succession Nobody Wrote Down)

Research standard: master plan §31. Status: `VERIFIED` / `INFERENCE` / `UNKNOWN`.
Date: 2026-09-19.

---

## R1. Current bee-js version

### Question
What bee-js version pins feed/storage/stamp APIs?

### Source
npm registry (`npm view @ethersphere/bee-js dist-tags`)

### Version
13.1.0

### Verified API
Namespaced surface: `bee.feed.*`, `bee.storage.*`, `bee.stamp.*`.

### Decision
Pin `@ethersphere/bee-js@^13.1.0`.

---

## R2. Feed primitives (verified)

### Question
Which feed APIs support root indirection and signed updates?

### Source
Official bee-js — soc-and-feeds
(https://bee-js.ethswarm.org/docs/soc-and-feeds/) and Feed/FeedWriter/FeedReader API

### Version
13.x

### Verified API
- `bee.feed.makeWriter(topic, signer?)`; `bee.feed.makeReader(topic, owner)`
- `writer.uploadPayload(batchId, data)` / `uploadReference(batchId, reference)`
- `reader.downloadPayload()` / `downloadReference()` → `{ reference, feedIndex, feedIndexNext }`
- `bee.feed.createManifest(batchId, topic, owner)` (stable URL for one owner+topic)

### Observed Behavior
A feed is addressed by **owner public key + topic**. Updates are signed by the owner
key. Indexes are network-resolved; a feed without updates throws on read.

### Decision
Two-hop indirection: an **authority-owned root feed** stores the current publisher
identity; a **publisher-owned feed** stores content.

### Implementation Consequence
Reader starts from (root owner, root topic) permanently; it never starts from
`currentPublisherAddress`.

---

## R3. Mechanism selection for the stable pointer (decision)

### Question
Which primitive gives a stable reader address that survives publisher rotation?

### Source
Evaluation: SOCs, feed manifests, ACT, contract-based authority —
[ACT](https://bee-js.ethswarm.org/docs/act/), SOC/feeds
(https://bee-js.ethswarm.org/docs/soc-and-feeds/)

### Version
13.x

### Verified API / analysis
- **SOC**: single owner-signed chunk; replaces previous update for the same
  identifier; gives a write-any-time mutable cell but no sequencing beyond owner.
  Workable, but feeds already provide identical semantics with index tracking.
- **Feed manifest**: immutably bound to one `owner+topic`; cannot re-point to a
  *different owner*. **Ruled out** for rotation.
- **ACT**: access-control *encryption* (grantee keys), not authority rotation.
  **Ruled out**.
- **Root feed owned by a succession authority**: content = current publisher
  identity; authority signs rotation. Uses only verified feed primitives; cleanly
  separates "who may repoint" (authority) from "who signs content" (publisher).

### Decision
Use a **root feed** owned by the succession authority as the stable indirection.
No DAO.

### Implementation Consequence
`src/authority/root.ts`: `readRoot(authorityOwner, rootTopic)`,
`writeRoot(signer, rootTopic, {publisher, topic, nonce})`.

---

## R4. Separate pay / publisher / authority (design)

### Question
How are the three identities kept functionally separate with bee-js?

### Source
Master plan §19/§21/§25; bee-js Chequebook/Stake + Storage docs
(https://bee-js.ethswarm.org/docs/storage/)

### Version
13.x

### Verified API
- **Payer**: node wallet that owns the postage batch (`bee.stamp.create/getAll`;
  batches listed under the node's wallet).
- **Publisher / authority**: feed signers via `bee.feed.makeWriter(topic, signer)`;
  a signer is a `PrivateKey` (from `.env`), independent of the node wallet.

### Observed Behavior
Feeds are per-signer-key; batches are per-node-wallet. These can be (and should be)
different entities.

### Decision
`PAYER_IDENTITY`, `PUBLISHER_IDENTITY`, `SUCCESSION_AUTHORITY_IDENTITY` are three
distinct values. Payer funds storage; publisher signs content; authority signs the
root pointer.

### Implementation Consequence
`identity.ts` exports three roles; unit test asserts `payer !== publisher` and
`authority !== publisher`. Authoritative: no key may serve two roles in tests.

---

## R5. Storage extension (verified)

### Question
How is existing storage extended rather than rebought?

### Source
Official bee-js — Storage class + Stamp class
(https://bee-js.ethswarm.org/docs/api/classes/Storage/,
https://bee-js.ethswarm.org/docs/api/classes/Stamp/)

### Version
13.x

### Verified API
```
bee.storage.buy(size, duration)                         // new batch (init only)
bee.storage.extend(batchId, size, duration)
bee.storage.extendDuration(batchId, duration)
bee.storage.extendSize(batchId, size)
bee.stamp.topUp(batchId, amount)
bee.stamp.get(batchId) → PostageBatch { duration, usable, usage, remainingSize, ... }
```

### Observed Behavior
Extension APIs take an **existing** batch id; `topUp` increases duration by amount.
`get` reports current duration/usable for decision-making.

### Decision
Init buys once; all subsequent operations call extend/top-up on the **same**
`BATCH_ID`. `BATCH_ID` provenance from `.env` or init output; extension CLI reuses it.

### Implementation Consequence
`src/storage/extension.ts` asserts the batch id equals the existing one (test proves
"extended", not "new batch purchased").

---

## R6. Hand-off evidence artifacts (design)

### Question
What counts as valid evidence of a hand-off that actually happened?

### Source
Master plan §24

### Version
n/a

### Verified API
Valid artifacts: feed index, signed message, incoming identity address,
configuration before/after, public feed state, timestamped artifact.

### Decision
Evidence schema (burned at Phase-7 demo):

```json
{
  "OLD_STEWARD": "0x…",
  "NEW_STEWARD": "0x…",
  "EVIDENCE": {
    "rootTopic": "0x…",
    "feedIndexAfter": "…",
    "previousPublisher": "0x…",
    "rootReference": "0x…",
    "timestamp": "2026-…"
  }
}
```

No fabricated hashes in Phase 0; the artifact file documents the schema and the
planned demo steps.

### Implementation Consequence
`docs/hand-off-evidence.md` — schema + demo procedure, evidence to be filled only
from a real, observed hand-off.

---

## Consolidated API decision list (P3)

| Item | Method / symbol | Status | Source |
| ---- | --------------- | ------ | ------ |
| Feed writer | `bee.feed.makeWriter(topic, signer)`; `uploadPayload/uploadReference` | VERIFIED | soc-and-feeds |
| Feed reader | `bee.feed.makeReader(topic, owner)`; `downloadReference/DownloadPayload` | VERIFIED | soc-and-feeds |
| Feed state | `feedIndex`, `feedIndexNext` | VERIFIED | Feed/FeedReader |
| Empty feed | throws; catch → initial state | VERIFIED | soc-and-feeds examples |
| Feed manifest | `bee.feed.createManifest` (bound to one owner+topic) | VERIFIED | soc-and-feeds (ruled out for rotation) |
| Extension | `bee.storage.extend/extendDuration/extendSize`, `bee.stamp.topUp` | VERIFIED | Storage/Stamp classes |
| Batch state | `bee.stamp.get` → duration/usable | VERIFIED | PostageBatch |
| Version | @ethersphere/bee-js 13.1.0 | VERIFIED | npm dist-tags |

All core P3 mechanisms are VERIFIED. No `UNKNOWN` items remain for P3 at this stage.