# Problem 3 — The Succession Nobody Wrote Down (plan)

## 1. Mission

Build a real stewardship system: when the original steward disappears, storage stays
funded, the publishing authority changes, readers keep using the **same stable
entrypoint**, and the new steward can publish.

## 2. Goal & central property

```
original steward disappears
  → storage remains funded        (payer/extension path)
  → publishing authority changes  (succession authority rewrites the pointer)
  → readers keep using the same stable entrypoint   (root feed)
  → new steward publishes         (new publisher key, same root)
```

## 3. Why Swarm

- Feeds give stable, signed, mutable pointers — the right primitive for a "root"
  that indirection must survive.
- Postage batches bound storage funding to a node wallet (payer); feed signatures
  bind updates to a publisher key; these are **separate concerns**.
- Storage extension APIs (`bee.storage.extend*`, `bee.stamp.topUp`) make continuity
  explicit instead of re-buying fresh storage.

## 4. Repository structure

```text
problem-3-succession/
  .git/
  README.md  plan.md  research.md  action.md
  package.json  tsconfig.json  .env.example  .gitignore
  src/
    config.ts
    identity.ts            # key handling (private keys only from .env)
    storage/extension.ts   # extend/top-up an existing batch
    authority/{root,transfer}.ts   # root-feed pointer, transferPublisher(incoming)
    publisher/publisher.ts # content feed writer under current publisher
    reader/reader.ts       # stable-entrypoint reader
    cli/{init,extend,publish,handoff,verify}.ts
  tests/{identity,storage,authority,reader,security}.test.ts
  docs/
    succession-agreement.md
    authority.md
    hand-off-evidence.md
    evaluator-audit.md
```

## 5. Requirements → evaluator checks

| Req | Check | Pts | Planned implementation |
| --- | ----- | --: | ---------------------- |
| §20 | Stable indirection | 20 | two-hop feeds: authority root feed → publisher feed → content |
| §21 | Separate payer/publisher | 12 | `PAYER_IDENTITY` (funds batch) ≠ `PUBLISHER_IDENTITY` (signs feed); test asserts distinct |
| §22 | Storage extension | 10 | `bee.storage.extend/extendDuration/extendSize` or `bee.stamp.topUp` on the **same** batch |
| §23 | Written succession | 10 | `docs/succession-agreement.md` (steward, successor, trigger) |
| §24 | Actual hand-off | 10 | real evidence artifact (OLD_STEWARD / NEW_STEWARD / EVIDENCE) in Phase 7, never fake |
| §25 | Separate authority | 8 | authority key (root feed) ≠ publisher key (content feed); 2+ stewards configurable |
| §34 | No credentials | 6 | `.env` only; `git ls-files` audit |
| §26 | Incoming identity parameter | 4 | `transferPublisher(incomingPublisher)` — successor passed as parameter |

## 6. Core architecture (decided) — three identities

```text
PAYER_IDENTITY ──(node wallet)──► postage batch storage
PUBLISHER_IDENTITY ──(signs)────► content feed (topic="content")
SUCCESSION_AUTHORITY ──(signs)──► root feed (topic="succession-pointer")
```

- **Root feed** (stable reader entrypoint): owned by the succession authority.
  Its payload = `{ publisher, topic, nonce }` — the *current* publisher identity.
- **Publisher feed**: owned by the current publisher; payload = content reference /
  manifest.
- **Reader**: `root(owner=authority, topic) → {publisher} → publisher feed → content`.
- Succession = authority updates the root feed with the new publisher. The reader's
  initial identifier never changes.

Chosen over SOC / feed-manifest / DAO: a root feed is the simplest documented
primitive that genuinely gives a stable indirection owned by a party different from
the publisher (audit in `research.md` R3). No DAO (master plan: prefer simplest).

## 7. Transfer flow (P3-T6 / P3-T8)

```ts
async function transferPublisher(
  incomingPublisher: string,     // parameterized, never hardcoded
  authority: FeedSigner,
  rootTopic: Topic,
): Promise<{ old: string; next: string; evidence: FeedIndex }> {
  const current = await readRoot(rootTopic, authority.publicKey)
  writeRoot(rootTopic, { publisher: incomingPublisher, topic: current.topic, nonce: current.nonce + 1 })
  return { old: current.publisher, next: incomingPublisher, evidence: nextIndex }
}
```

Evidence burned to `docs/hand-off-evidence.md` during the Phase-7 real demo.

## 8. Succession agreement (P3-T4)

`docs/succession-agreement.md` states: current steward (public id), successor (public
id), triggering condition (30-day inactivity or formal transfer), and institution
context. Public identifiers only.

## 9. Storage continuity (P3-T3)

- Payer buys a batch once at init.
- Ongoing: `bee.storage.extend(batchId, size, duration)` /
  `bee.storage.extendDuration(batchId, duration)` / `bee.stamp.topUp(batchId, amount)`
  — always on the **existing** batch id.
- Status surfaced via `bee.stamp.get` (duration/usable) to decide when to extend.
- Test asserts extension targets the same `BATCH_ID` (not a fresh purchase).

## 10. Reader contract (P3-T1)

```bash
npm run read -- --authority 0x… --root-topic 0x…
```

1. resolve root feed → current publisher
2. resolve publisher feed → content reference
3. download content

## 11. Security strategy

- Three distinct keys; never collapsed. Keys only via `.env` (git-ignored).
- `docs/` and tracked configs contain public identifiers only.
- Authority hand-off rejected if `incomingPublisher` equals current publisher
  (no-op guard); audit trail = root feed index.

## 12. Configuration & environment

```env
BEE_URL=http://localhost:1633
PAYER_IDENTITY=             # public address funding storage — placeholder
PUBLISHER_IDENTITY=         # private key signing content feed — placeholder
SUCCESSION_AUTHORITY_IDENTITY=  # private key signing root feed — placeholder
BATCH_ID=                   # existing batch to extend — placeholder
```

## 13. Testing strategy

| Layer | Coverage |
| ----- | -------- |
| Unit | identity separation (payer≠publisher≠authority); transfer parameterization; no-op guard |
| Integration (mock Bee) | root→publisher resolution; extension on same batch id |
| Source/evaluator | agreement present; transfer takes parameter; no secrets |
| Manual | real hand-off + reader still resolves via old entrypoint (Phase 7) |

## 14. TypeScript / build setup (planned Phase 2)

Node 22 ESM, strict tsconfig; `node:test` runner; CLI commands via `package.json`
scripts (init / extend / publish / handoff / verify / read).

## 15. 12-hour schedule

| Phase | Duration | Notes |
| ----- | -------: | ----- |
| P0 research | 60–90m | done (research.md) |
| P1 plan | 30m | done (this file) |
| P2 foundation | 45m | TS/identity/config |
| P5 core | 120m | root feed, transfer, extension, reader, evidence schema |
| P6 testing | 60m | unit + integration + audit |
| P7 demo | 30–45m | real hand-off with two identities |
| P8/9 docs+audit | 60m | evaluator-audit.md |

## 16. Kill switches (master plan §38)

- Advanced mechanism unstable >30m → smallest defensible authority separation:
  a single root feed + authority key distinct from publisher (still satisfies T1/T6).
- No real hand-off possible → never fake; document limitation (Kill switch 4).

## 17. Research results & flags

All feed/storage/stamp primitives VERIFIED (see `research.md`). Mechanism selection
documented (root feed; ACT and SOC ruled out; feed-manifest rules out for rotation).

## 18. Interoperability

Sharing the pact with P1: reader example (P1 recovery) already resolves references
from feeds; P3's root→publisher→content chain extends the same feed/reader concepts.
Content payload can be a `swarm-preservation-archive` manifest reference.

## 19. Traceability matrix

Workspace `docs/traceability-matrix.md` rows P3-T1…P3-T8. Statuses:
RESEARCHED/PLANNED — nothing implemented.

## 20. Risks & re-verification flags

| Risk | Mitigation |
| ---- | ---------- |
| Real hand-off evidence needs a live Bee | Schedule Bee bring-up before Phase 5; evidence contract defined now |
| Feed stamp cost during hand-off | Root writes are single small updates; batch funded by payer |
| Identities colliding | `identity.ts` derives public keys fresh per run from `.env`; unit test asserts distinct |
| Extension semantics differ by installed version | Verify exact installed 13.1.0 exports in Phase 2 |

## 21. Definition of done (planning)

- [x] Stable indirection mechanism selected (root feed) and primitives verified
- [x] Payment/publisher/authority separation designed
- [x] Storage extension path designed (same-batch)
- [x] Succession agreement + evidence schema designed
- [x] Transfer parameterized
- [x] Security + git strategy written
- [x] No implementation claims made without evidence