# Problem 3 — The Succession Nobody Wrote Down

> Phase 0 (research + plan). Implementation **NOT STARTED**.

## 1. Problem
When the original steward of a Swarm-preserved space disappears, storage must remain
funded, the publishing authority must move to a successor, and readers must keep
resolving through the **same** stable entrypoint.

## 2. Why Swarm
Feeds offer signed, stable, mutable pointers — a root feed can stay fixed while its
target (the current publisher) changes. Postage batches tie storage funding to a
payer wallet; feed signatures tie updates to a publisher key. Succession = an
authority rewriting the root pointer, using only verified feed primitives.

## 3. Architecture
Three distinct identities:

```text
PAYER ──funds──► postage batch
PUBLISHER ──signs──► content feed
SUCCESSION_AUTHORITY ──signs──► root feed (stable entrypoint)
```

Reader path: `root feed → current publisher → content feed`.

## 4. Prerequisites
- Node.js 22+, npm 11+
- Bee node (`http://localhost:1633`) + funded postage batch (payer wallet)
- `@ethersphere/bee-js@^13.1.0`

## 5. Installation
Planned (Phase 2): `npm install` after `package.json` is added.

## 6. Configuration
Copy `.env.example` → `.env`:
`PAYER_IDENTITY`, `PUBLISHER_IDENTITY`, `SUCCESSION_AUTHORITY_IDENTITY`, `BEE_URL`,
`BATCH_ID` (all placeholder values; keys never committed).

## 7. Running
Planned CLI: `init` (buy batch + publish root), `publish` (write content feed),
`handoff --incoming <publisher>`, `extend`, `read` (stable-entrypoint reader),
`verify` (audit root chain).

## 8. Demo
Planned (Phase 7): init with steward A → publish → hand off to steward B via the
authority → readers resolve the **unchanged** root and see B's content. Evidence
written to `docs/hand-off-evidence.md` from the real rotation.

## 9. Recovery
`docs/authority.md` explains root → publisher → content resolution; hand-off evidence
procedure in `docs/hand-off-evidence.md`.

## 10. Test results
No code yet. Test plan in `plan.md` §13; per-check template in
`docs/evaluator-audit.md`.

## 11. Evaluator traceability
`plan.md` §5 and workspace `docs/traceability-matrix.md` (P3-T1…P3-T8).

## 12. Security
Three separate keys, never collapsed; keys only in `.env` (git-ignored); docs carry
public identifiers only; final audit via `git ls-files` (master plan §34).

## 13. Limitations
- Hand-off evidence requires a live Bee + real tokens at demo time.
- Root feed writes consume stamps from the payer batch (tiny, but real).

## 14. Interoperability
Reuses the feed conventions of P1; the root pointer's content can itself point to a
`swarm-preservation-archive` manifest reference, tying stewardship to the P1 archive.

## 15. Reproduction instructions
Init → publish → hand-off → read steps will be captured verbatim in Phase 8 docs
(`docs/reproduction.md`), pending a live hand-off.

---

## Appendix A — Succession agreement
`docs/succession-agreement.md` names the current steward, successor, and the
triggering condition (30 consecutive days of inability, or formal transfer).