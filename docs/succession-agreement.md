# Succession Agreement — Deccan Manuscripts Preservation Collective

**Purpose.** This document names the current publishing steward, the successor, and
the condition under which publishing authority transfers. It is a **tracked**
document (part of this repository) so that succession is written down and auditable.

Status: **Post-init.** The public identifiers below are the real identities used by
this repository's live succession flow (published by a verified A → B hand-off,
see `docs/hand-off-evidence.json`). They are the *public* keys derived from the
configured identities — no private keys ever appear in this file.

## Current steward

- Public identifier: `0x579f0d1d9db1c00017deeef2ea03ab68b558371d`
- Role: signs the **content feed** for the preserved archive (the `PUBLISHER_IDENTITY`
  in this project's configuration).

## Successor

- Public identifier: `0x2232eadcdf5c30c7c2654c1384b15b489733c33e`
- Role: shall become the publisher (signer of the content feed) after the triggering
  condition below is met and the succession authority performs the hand-off.

## Succession authority

- Public identifier: `0x73e477523a17a3d3d7369b3e4cef7a9609406c67`
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
4. The hand-off is recorded in `docs/hand-off-evidence.json` (and summarized in
   `docs/hand-off-evidence.md`): `OLD_STEWARD`, `NEW_STEWARD`, `EVIDENCE`
   (root feed index & reference, timestamp). A completed, verified A → B hand-off
   against the live Bee node is already recorded there.

## Institutions

The agreement is written in terms understandable to the seven participating
institutions (library, archive, university, museum, temple trust, heritage society,
digital preservation lab): a steward who stops publishing for 30 days may be replaced
by a named successor, with the change recorded on the public ledger.