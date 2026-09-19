# Evaluator Audit — Problem 3 (template)

Filled with PASS/fail evidence at the end of Phase 9. Statuses below are Phase-0
planning states.

## P3-T1 — Stable indirection (20 pts)

- Status: RESEARCHED
- Source: src/authority/root.ts + src/reader/reader.ts
- Evidence: root feed entrypoint unchanged across publisher change (demo in Phase 7)
- Test: integration (resolution after rotation); manual demo
- Confidence: HIGH (verified feed primitives)

## P3-T2 — Separate payer/publisher (12 pts)

- Status: PLANNED
- Source: src/identity.ts + src/config.ts
- Evidence: `PAYER_IDENTITY !== PUBLISHER_IDENTITY`; different functions
- Test: identity.test.ts (distinct roles), storage.test.ts

## P3-T3 — Storage extension (10 pts)

- Status: RESEARCHED
- Source: src/storage/extension.ts
- Evidence: extend/top-up on the existing `BATCH_ID` (same batch, not a resale)
- Test: storage.test.ts (assert same batch id)

## P3-T4 — Written succession (10 pts)

- Status: PLANNED
- Source: docs/succession-agreement.md
- Evidence: steward + successor + trigger, public ids only
- Test: source/evaluator check (file exists, no keys)

## P3-T5 — Actual hand-off (10 pts)

- Status: PLANNED (schema defined; event real in Phase 7)
- Source: docs/hand-off-evidence.md
- Evidence: OLD_STEWARD / NEW_STEWARD / EVIDENCE from real rotation
- Test: source/evaluator check (artifact fields present post-demo)

## P3-T6 — Separate authority (8 pts)

- Status: RESEARCHED
- Source: src/authority/root.ts
- Evidence: authority key ≠ publisher key; only authority rewrites root
- Test: authority.test.ts (transfer requires authority signer)

## P3-T7 — No credentials (6 pts)

- Status: PLANNED
- Source: .env.example + git ls-files audit
- Evidence: no secrets in tracked files
- Test: security.test.ts

## P3-T8 — Incoming identity parameter (4 pts)

- Status: PLANNED
- Source: src/authority/transfer.ts
- Evidence: `transferPublisher(incomingPublisher)` takes the successor as a parameter
- Test: authority.test.ts (two different successors supplied)