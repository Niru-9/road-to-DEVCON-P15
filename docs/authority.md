# Authority Design — stable indirection

## Reader entrypoint (never changes)

```text
ROOT = (authority owner, topic "succession-pointer")
```

The reader stores exactly this one identifier. It never receives the current
publisher's address as its starting point.

## Resolution

1. `bee.feed.makeReader(rootTopic, authorityOwner)` → read root feed.
   Payload: `{ publisher, topic, nonce }`.
2. `bee.feed.makeReader(publisher.topic, publisher.key)` → read content feed.
   Payload: content reference (e.g. a `swarm-preservation-archive` manifest reference).
3. Download content.

## Rotation

```text
authority signs: root = { publisher: NEW, topic: …, nonce: +1 }
```

The reader's initial identifier is unchanged; the root pointer is the only thing
that moves.

## Why not other primitives (research.md R3)

| Primitive | Verdict |
| --------- | ------- |
| SOC | per-owner mutable cell, but feeds already add index tracking |
| Feed manifest | immutable binding to one `owner+topic` — cannot change owner |
| ACT | access-control encryption, not rotation |
| DAO/multi-sig contract | heavier than needed; master plan prefers simplest true separation |

## Data format for the root payload

```json
{ "publisher": "0x…", "topic": "0x…", "nonce": 0 }
```

## Verify command

`npm run verify` resolves the chain and prints: root index, current publisher, current
content reference, and freshness (empty-feed handling on both hops).