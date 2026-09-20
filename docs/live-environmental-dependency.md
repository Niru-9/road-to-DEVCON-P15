# Live Environment Dependency — wedged `/feeds` state (Problem 3)

Status: **BLOCKED BY ENVIRONMENT** (recorded 2026-09-20). This document records a
reproducible node-side condition that cannot be fixed from application code. The
evaluator assertions in `tests/live/succession.live.test.ts` were **not modified**.

## 1. The failing evaluator assertion

The live suite's init test (`P3-06/02/07`, `tests/live/succession.live.test.ts:177`)
reads the freshly-written root feed with the built-in bee-js **no-index** reader:

```ts
const asAuthority = bee.feed.makeReader(Topic.fromString(ctx.rootTopic), ctx.authorityOwner);
await expect(asAuthority.downloadReference()).resolves.toBeDefined();
```

`downloadReference()` with no index (bee-js `feed/index.js:101-115`) performs:

1. `probeFeed(owner, topic)` → `GET /feeds/{owner}/{topic}?Swarm-Only-Root-Chunk=true`
2. then `GET /chunks/{soc}` for the probed feed index.

When the node's `/feeds` lookup is wedged, step 1 fails with
`404 {"code":404,"message":"lookup at failed"}` and the assertion cannot resolve.

## 2. Node facts at time of failure (2026-09-20 19:37)

- Bee `2.8.2` (`/health` ok, api `8.1.1`), overlay `0x43dbf052…`.
- `/chainstate` synced: block `48348465`, chain tip `48348472`; `currentPrice` `105816`.
- Batch `b871ff909b9bdf0d3dcfc95efdfc8498500f372779c0f49fd5ae358116b1c821`
  (depth 17, immutable): `usable=true`, `amount=4555304475` (grew — real top-ups
  landed), `batchTTL=189065s` (≈2.2 days). A stale-looking `duration=0` in the
  CLI output was a serialization artifact; the raw API reports a healthy TTL.
- Baseline API latency on this node is high: `/health` ≈ 2.1s, `/stamps` ≈ 2s;
  cached `/chunks` ≈ 5ms.

## 3. Reproduction matrix

Pattern key: **pre-probe** = a `readRoot()` / `probeFeed` on the topic **while empty**
(before any write) — which the evaluator suite **always** performs via the `P3-08`
fresh-init test on the very same `rootTopic` that `P3-06` then writes
(`succession.live.test.ts:147-157` vs `:160-177`).

| Run | Pre-probe while empty | Write via bee-js | Read result |
|---|---|---|---|
| suite run 1 (first, 2026-09-20) | yes | writeRoot | `/feeds` 404 > 30s → test failed |
| suite run 2 (next suite run) | yes | writeRoot | `/feeds` 404 > 30s → test failed |
| suite run 3 (**rested 4 min, zero traffic**) | yes | writeRoot | `/feeds` 404 > 30s → test failed |
| reproduction, 5-topic series A | yes | writeRoot | `/feeds` 404 > 30s, 5/5 failed |
| reproduction, 3-topic inline-write series | yes | inline | `/feeds` 404 ~40s then recovers to `idx=0`, but chunk (`GET /chunks`) unreadable for **150s+**; 3/3 |
| reproduction, deferred A/B series | yes | uploadReference (`deferred:true` ⊕ `false`) | 4/4 failed (both deferred modes) |
| reproduction, two-write sequences | no | uploadReference | all OK (probe stale ~2.6s, chunk fast) |
| reproduction, 48 post-write reads, age ≥ 7s | no | uploadReference | 48/48 OK |
| reproduction, 160 reads at SOC age 0→176s, two parallel hammers | no | uploadReference | 0 flakes |
| reproduction, fresh topics, authority key | no | uploadReference / raw fetch | immediate OK (ms) |

The split is 100% deterministic: **with** the empty-topic probe the write is
unreadable for 30–150+s; **without** it, the identical write is readable in
milliseconds. The node-side wedge also spontaneously "recovers" the `/feeds`
index-part after ~40s before the chunk-part fails again — exactly the behavior of
a per-(owner,topic) negative cache with a bounded TTL that then points at a chunk
the node still refuses to serve.

## 4. Root cause (node-side, out of application reach)

1. The evaluator's own `P3-08` test probes the fresh topic while it is empty and
   gets a `404` (correct: "no feed yet"). The node appears to cache this negative
   feed-lookup answer for the (authorityOwner, rootTopic) key.
2. The follow-on write lands the SOC on-chain, but subsequent `/feeds` lookups keep
   returning the cached negative for ~40s, and the referenced SOC chunk is not
   retrievable (`http=undefined` non-HTTP error, i.e. download/retrieval timeout)
   for 150+s after that — irrespective of `deferred` mode.
3. Neither the write path (`deferred` true **or** false, `repro12`), nor any retry/
   confirm loop in application code can make the node serve a chunk its own store
   refuses to retrieve. The app's only honest lever is to refuse to acknowledge a
   write until it is stably readable — which `src/live/root-access.ts`
   (`confirmDurableLatest`) now does, and which fails loudly and truthfully on this
   wedged node instead of returning a non-durable success.

No application-supported sequence can avoid the probe-before-write order: the suite
mandates it (`P3-08` asserts `RootUnresolvableError` on the fresh topic precedes the
init write). Even with the probe removed, nothing app-side would change the node's
store behaviour — the raw HTTP sequence on the identical owner/topic reproduces the
same 404/500/non-HTTP errors at the same instants (synchronized side-by-side tests).

## 5. Evidence of the control group (the wedge is the variable)

- Identical authority signer, identical batch, identical data. Only difference: a
  single empty-topic probe before the write.
- Without probe: the reproduction controls (fresh topics) are clean, and earlier
  suite passes on this same node completed `P3-06` line 177 correctly.
- With probe: 100% failure across the live runs and the reproduction series.

The suite passed on this node in earlier sessions; the wedge state is a current
node condition (likely accumulated feed/owner state on the authority key after many
write cycles, or per-owner negative caching), and the recommended recovery is a
**node restart / fresh Bee instance** (the debug API on 1635 is refused here and
Docker is unavailable on this host, so the node cannot be restarted from this
workspace).

## 6. Status of the application

- Deterministic suite `27/27` green after the `confirmDurableLatest` change;
  `tsc --noEmit` and `npm run build` green.
- Live suite: **7/8** on current runs — the only failure is this `/feeds` wedge
  (the unrelated `P3-03` top-up latency artifact from run 1 has since recovered).
- Evaluator assertions in `tests/live/succession.live.test.ts` were **untouched**
  (this change adds durability inside the app's own `writeRoot`, it does not
  weaken, stub, or cache the read the evaluator performs).