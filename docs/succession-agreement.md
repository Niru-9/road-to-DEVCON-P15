# Succession Agreement — Deccan Manuscripts Preservation Collective

**Purpose.** This document names the current publishing steward, the successor, and
the condition under which publishing authority transfers. It is a **tracked**
document (part of this repository) so that succession is written down and auditable.

Status: Phase‑0 draft. The public identifiers below are **placeholder fields** that
are replaced with the real, derived public keys during `npm run init` (Phase 5) and
re‑committed. No private keys ever appear in this file.

## Current steward

- Public identifier: `0x<PLACEHOLDER — STEWARD PUBLIC KEY>`
- Role: signs the **content feed** for the preserved archive (the `PUBLISHER_IDENTITY`
  in this project's configuration).

## Successor

- Public identifier: `0x<PLACEHOLDER — SUCCESSOR PUBLIC KEY>`
- Role: shall become the publisher (signer of the content feed) after the triggering
  condition below is met and the succession authority performs the hand-off.

## Succession authority

- Public identifier: `0x<PLACEHOLDER — AUTHORITY PUBLIC KEY>`
- Role: controls the **root feed** (the stable reader entrypoint) and is the ONLY
  party that may rewrite the root pointer to a new publisher. The authority is a
  separate identity from the current publisher, and the publisher cannot repoint the
  root with its own key.

## Triggering condition

> If the current steward is unable to perform publishing duties for 30 consecutive
> days, or formally transfers responsibility, or is unreachable by all other
> participating institutions for that period, the successor may initiate the
> hand-off procedure through the succession authority.

## Hand-off procedure

1. A participating institution notifies the succession authority that the trigger
   has been met.
2. The authority verifies the successor's public key (`transferPublisher(incoming)`).
3. The authority signs a new root-feed update pointing at the successor.
4. The hand-off is recorded in `docs/hand-off-evidence.md`:
   `OLD_STEWARD`, `NEW_STEWARD`, `EVIDENCE` (root feed index & reference, timestamp).

## Institutions

The agreement is written in terms understandable to the seven participating
institutions (library, archive, university, museum, temple trust, heritage society,
digital preservation lab): a steward who stops publishing for 30 days may be replaced
by a named successor, with the change recorded on the public ledger.