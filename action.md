# Action Report — Problem 3 (The Succession Nobody Wrote Down)

## Timestamp
2026-09-19 (Phase 0 close)

## Repository
`problem-3-succession`

## Objective
Complete Phase 0 (research + plan) for a real stewardship system: stable reader
indirection, separate payer/publisher/authority, storage extension, parameterized
succession, and a designed (not fabricated) hand-off evidence path. No application
code in this phase.

## Completed
- Verified feed primitives (writer/reader/manifest/index; empty-feed behavior).
- Selected the stable indirection mechanism (authority-owned **root feed**);
  documented why SOC/ACT/feed-manifest were ruled out (research.md R3).
- Verified storage extension APIs (`bee.storage.extend/extendDuration/extendSize`,
  `bee.stamp.topUp`) for same-batch extension.
- Designed three-role identity separation (payer ≠ publisher ≠ authority).
- Designed parameterized `transferPublisher(incomingPublisher)` and no-op guard.
- Defined hand-off evidence schema (OLD_STEWARD / NEW_STEWARD / EVIDENCE) to be
  burned from a real demo.
- Wrote 21-section `plan.md` and this report.

## Files Created
plan.md, research.md, action.md, README.md, .env.example, .gitignore,
docs/succession-agreement.md, docs/authority.md, docs/hand-off-evidence.md,
docs/evaluator-audit.md (template)

## Files Modified
(none)

## APIs Used
None at runtime. Verified signatures only (see research.md): `bee.feed.makeWriter/
makeReader/createManifest`, `FeedWriter.uploadPayload/uploadReference`,
`FeedReader.downloadReference/downloadPayload`, `bee.stamp.get/topUp`,
`bee.storage.extend/extendDuration/extendSize`.

## Tests Added
None this phase (no code yet). Plan defined in plan.md §13; template in
docs/evaluator-audit.md.

## Tests Run
Phase-0 validation only (workspace docs/validation-phase0.md): git checks, npm view,
gateway probe.

## Results
Planning DoD (plan.md §21): all items satisfied. P3-T1…P3-T8 mapped in workspace
docs/traceability-matrix.md (RESEARCHED/PLANNED, none IMPLEMENTED).

## Build
n/a — no application sources yet (planned Phase 2).

## Security Audit
`git ls-files` at repo creation: docs only; no key material. `.env.example`
placeholders only. `docs/succession-agreement.md` names public identifiers only.

## Evaluator Checks Satisfied
P3-T1 → RESEARCHED (root-feed design + verified primitives).
P3-T3 → RESEARCHED (extension APIs verified).
P3-T6 → RESEARCHED (authority ≠ publisher mechanism).
P3-T2, P3-T4, P3-T5, P3-T7, P3-T8 → PLANNED (design decided).

## Remaining
Phase 2 foundation; Phase 5 core: root feed, transfer, extension, reader, evidence
generation; live hand-off demo (Phase 7) requiring a Bee node and three identities.

## Problems
- Hand-off evidence cannot be produced until a real publisher rotation runs against
  a live Bee. Contract and procedure are defined now; no fabricated hashes.

## Next Action
Phase-1+ implementation prompt in workspace `prompt.md` (after review); Phase 2
foundation per plan.md §14.

---

# Phase 1 FOUNDATION (2026-09-19)

## Objective
Strict foundation for the succession mechanics: separate payer/publisher/authority,
stable reader indirection, storage extension of the SAME batch, parameterized
incoming-publisher transfer, no fabricated hand-off evidence. No core succession
execution yet; no live writes.

## Completed
- Toolchain (pinned): TypeScript 5.9.3, bee-js **13.1.0**, @types/node 22.20.4,
  Vitest 4.1.11, ESM, NodeNext, strict.
- Modules: `src/errors.ts`, `src/config.ts` (`assertDistinctRoles`: PAYER ≠
  PUBLISHER ≠ AUTHORITY enforced at load, public identities derived from private
  keys via `identity.ts`), `src/identity.ts` (`resolveIdentity` via
  `new PrivateKey(hex).publicKey()`), `src/authority/root.ts` (`RootPointerRecord`,
  `RootAccess`, `resolveCurrentPublisher`), `src/authority/transfer.ts`
  (`transferPublisher(access, { incomingPublisher, ... })` — incoming steward is a
  **parameter**, never hardcoded; `NoOpTransferError` guards same-as-current;
  `TransferEvidence` records previous/next/nonce-after), `src/storage/extension.ts`
  (extend/top-up the **configured existing** batch id, never a rebuy),
  `src/publisher/publisher.ts`, `src/reader/reader.ts` (resolves root → current
  publisher → content through a stable entrypoint), `src/cli/main.ts` (dispatch
  stub: init/extend/publish/handoff/verify/read routed; execution in core).
- Tests (24 total, all PASS): `identity.test.ts`, `storage.test.ts`,
  `authority.test.ts`, `reader.test.ts`, `security.test.ts`:
  - identity: distinct derived owners; PUBLISHER vs AUTHORITY key collision throws;
    deterministic derivation; 0x-prefix normalization; config distinctness incl.
    derived-owner collisions (payer==publisher, publisher==authority)
  - storage: extension/top-up invoke the **same** batch id; flags reflect actions;
    unusable batch rejects (StorageExtensionError)
  - authority: incoming publisher required as parameter (no successor constant);
    hand-off writes pointer + nonce + evidence; no-op transfer rejected; 0x/case
    normalization in no-op detection
  - reader: root → publisher → content; never re-derives the entrypoint; typed
    RootUnresolvableError on missing feed
  - security: no 64-hex/mnemonic in src; no `.env` or dist tracked;
    publisher never imports the transfer execution path; transfer requires a
    parameterized incoming (arch-scan)
- Installed deps; `npm test` 24/24 green; `npm run typecheck` clean; `npm run build`
  clean; `npm audit` 0 vulnerabilities.
- Runtime-verified installed bee-js: `bee.feed.makeWriter/makeReader`, `bee.storage.
  extend/extendDuration/extendSize`, `bee.stamp.topUp/getAll`, `PrivateKey.
  publicKey().toHex()` returns a 128-hex (64-byte) public key.

## Build
test 24 passed, typecheck OK, build OK. `git ls-files` excludes node_modules/dist/.env.

## Evaluator Checks Satisfied
P3-T2 identity separation; P3-T3 same-batch extension; P3-T4 evidence schema (no
fabricated hashes); P3-T5 no-op guard + parameterized steward; P3-T6 authority ≠
publisher (roles + modules); P3-T7 64-hex/mnemonic scan clean; P3-T8 transfer
takes incoming publisher as a parameter; P3-T1 stable indirection. CORE (live
root feed, transfer, extension, reader) deferred to next phase.

## Remaining
Phase 2 core: live root-feed publish/read, hand-off (init + transfer) against a
real Bee, storage extension execution, reader CLI with evidence capture.

## Problems
- Hand-off evidence still cannot be produced until a real rotation runs against a
  live Bee (by design; schema and procedure defined, no fabricated hashes).