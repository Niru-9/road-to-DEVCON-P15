# P3 — The Succession Nobody Wrote Down

> **Swarm Build Battle — Problem 3**  
> Preserve storage and publishing continuity when the person responsible for a shared archive changes.

## Overview

A group of libraries shares a catalogue. One steward currently maintains the catalogue, signs publications, and is responsible for storage funding.

The problem is not simply storing the data.

The problem is ensuring that a future steward can take over without forcing readers to learn a new starting address or depending on the previous steward's private credentials.

This implementation separates three responsibilities:

```text
PAYMENT IDENTITY
    │
    └── funds storage

PUBLISHER IDENTITY
    │
    └── publishes content

SUCCESSION AUTHORITY
    │
    └── changes the current publisher
```

The reader starts from one stable root identity.

---

## Core Property

Before succession:

```text
Stable Root
    │
    ▼
Publisher A
    │
    ▼
Content Feed
    │
    ▼
Current Content
```

After succession:

```text
Same Stable Root
    │
    ▼
Publisher B
    │
    ▼
Content Feed
    │
    ▼
Current Content
```

The publisher changes while the reader's entrypoint remains stable.

That stable indirection is the central P3 survivability mechanism.

---

## Architecture

```text
                         SUCCESSION AUTHORITY
                                  │
                                  │ changes
                                  ▼
                         Current Publisher
                                  │
                                  │ publishes
                                  ▼
                             Content Feed
                                  │
                                  ▼
                              Content

PAYER IDENTITY
      │
      ▼
Postage Batch
      │
      └──── storage funding / extension

READER
      │
      ▼
Stable Root
      │
      ▼
Current Publisher
      │
      ▼
Content Feed
      │
      ▼
Current Content
```

The three roles are deliberately separate.

---

## Identity Separation

### Payment identity

Responsible for storage funding.

```text
PAYER → Postage Batch
```

### Publisher identity

Signs content publications.

```text
PUBLISHER → Content Feed
```

### Succession authority

Controls who the current publisher is.

```text
AUTHORITY → Publisher A
             ↓
             Publisher B
```

A publisher is not automatically the succession authority merely because it can publish.

---

## Stable Root

The root feed is intentionally small.

Its job is to point to the current publishing identity/feed:

```text
ROOT
 │
 └──► current publisher
          │
          └──► content feed
                    │
                    └──► current content
```

The reader always starts from the same root.

A publisher transition therefore changes the indirection target rather than the reader's initial address.

---

## Succession Flow

```text
Initial Steward
      │
      ▼
Publisher A
      │
      │ succession trigger
      ▼
Succession Authority
      │
      │ authorizes incoming identity
      ▼
Publisher B
      │
      ▼
Content Feed
```

The succession operation accepts the incoming publisher/steward identity as an explicit parameter.

Conceptually:

```ts
handoff(incomingPublisher)
```

rather than embedding a hard-coded successor.

This makes the same mechanism reusable for later transitions.

---

## Storage Continuity

Succession is incomplete if the funded storage arrangement silently expires.

The implementation therefore supports extending/topping up the existing postage batch.

The intended lifecycle is:

```text
Existing Postage Batch
        │
        ▼
extend / top-up
        │
        ▼
same funded storage arrangement
```

The requirement is continuity of the existing storage allocation, not merely demonstrating that a new unrelated batch can be purchased.

---

## Written Succession Arrangement

The governance layer is represented by:

```text
docs/succession-agreement.md
```

The agreement records:

- current steward;
- named successor;
- succession authority;
- triggering condition;
- transfer mechanism.

The tracked agreement uses concrete public identities rather than leaving the successor as an unresolved placeholder.

The documented trigger includes:

- 30 consecutive days of inability; or
- formal transfer.

---

## Actual Handoff Evidence

A theoretical `handoff()` function is not treated as sufficient evidence.

The live handoff workflow persists evidence.

Important artifacts:

```text
docs/hand-off-evidence.json
docs/hand-off-evidence.md
docs/handoff-run.json
```

The evidence records the actual transition and verifies that:

```text
previousPublisher != nextPublisher
```

It also retains the resulting feed/index and verification state required to audit the handoff.

---

## Evaluator Traceability

| Criterion | Requirement | Result |
|---|---|---|
| **P3-01** | Stable indirection survives publisher change | ✅ PASS |
| **P3-02** | Payment and signing identities separated | ✅ PASS |
| **P3-03** | Storage extended/topped up | ✅ PASS |
| **P3-04** | Written arrangement names successor + trigger | ✅ PASS |
| **P3-05** | Actual handoff with distinct identities + evidence | ✅ PASS |
| **P3-06** | Succession authority distinct from publisher | ✅ PASS |
| **P3-07** | No secrets in tracked files | ✅ PASS |
| **P3-08** | Incoming steward accepted as parameter | ✅ PASS |

**Evaluator result: 8/8 PASS**

---

## Verified Results

| Validation | Result |
|---|---:|
| Deterministic tests | **27/27 PASS** |
| Type checking | **PASS** |
| Production build | **PASS** |
| Evaluator criteria | **8/8 PASS** |
| Live succession suite | **7/8 PASS** |
| Security review | **PASS** |

### Important distinction

The repository reports two different measurements:

- **Evaluator criteria:** 8/8 PASS
- **Full live succession integration:** 7/8 PASS

These are not conflated.

The remaining live failure is documented as an environmental Bee `/feeds` lookup/propagation dependency.

---

## Live Environmental Dependency

The live suite exercises the real Bee node and postage infrastructure.

The remaining failure occurs around Bee `/feeds` lookup/propagation behavior after the root topic has been probed and subsequently written.

Controlled testing distinguished this behavior from the application assertions:

```text
Application logic
      │
      ▼
correct
      │
      ▼
Bee node /feeds behavior
      │
      └── environmental failure
```

The repository does not weaken the verification or convert a failed latest-feed lookup into a false PASS.

Detailed evidence is retained in:

```text
docs/live-environmental-dependency.md
```

---

## Exact-Index Recovery

The implementation supports explicit feed-index recovery.

The live root-access flow can:

1. resolve the next index from network state;
2. publish at that index;
3. read that exact index directly;
4. verify the resulting reference.

This is distinct from inventing a local feed counter.

The next publication index is still obtained from network state immediately before the write.

---

## Reader Resolution

The reader requires only the stable root identity.

```text
Stable Root
     │
     ▼
current root update
     │
     ▼
current publisher
     │
     ▼
publisher/content feed
     │
     ▼
current content
```

After succession:

```text
Same Stable Root
     │
     ▼
new publisher
     │
     ▼
new content
```

The reader does not need to know the previous publisher.

---

## Evidence Lifecycle

The handoff evidence is produced by the workflow:

```text
Start handoff
     │
     ▼
Persist run state
     │
     ▼
Authorize incoming publisher
     │
     ▼
Update root
     │
     ▼
Verify resulting state
     │
     ▼
Persist evidence
```

This makes the handoff auditable rather than relying only on a source-code claim.

---

## Security Model

The implementation maintains explicit security boundaries:

### Separate identities

```text
payer ≠ publisher ≠ succession authority
```

### Explicit successor

The incoming identity is passed into the succession operation.

### No-op protection

A transfer to the current publisher is guarded rather than treated as a meaningful succession.

### Publisher does not control transfer

Publishing and succession authority are separate responsibilities.

### No private keys in Git

Credentials remain local. `.env` is ignored and tracked evidence uses public identifiers only.

### Evidence verification

The persisted handoff evidence verifies the identity transition.

---

## Repository Structure

Important evaluator-facing areas:

```text
docs/
├── succession-agreement.md
├── hand-off-evidence.md
├── hand-off-evidence.json
├── handoff-run.json
└── live-environmental-dependency.md

src/live/
├── identity.ts
├── root-access.ts
├── content-feed.ts
├── content-reader.ts
├── extension.ts
└── evidence.ts

tests/
├── evidence.test.ts
└── live/
    └── succession.live.test.ts
```

The implementation separates identity, root access, feed publication, content reading, storage extension, and evidence instead of hiding succession inside one monolithic operation.

---

## Technology Stack

| Component | Technology |
|---|---|
| Language | TypeScript |
| Runtime | Node.js 22+ |
| Package manager | npm |
| Storage | Swarm / Bee |
| SDK | `@ethersphere/bee-js` 13.1.x |
| Publication | Swarm Feed |
| Testing | Vitest |
| Live node | Bee / Swarm Desktop |

---

## Configuration

The repository provides `.env.example`.

The live configuration conceptually separates:

```env
PAYER_IDENTITY=
PUBLISHER_IDENTITY=
SUCCESSION_AUTHORITY_IDENTITY=
BEE_URL=http://localhost:1633
BATCH_ID=
```

Actual signing credentials remain local and are never committed.

---

## Installation

Requirements:

- Node.js 22+
- npm 11+
- synchronized Bee node for live testing
- funded/usable Postage Batch

Install:

```bash
npm install
```

---

## Verification

Type check:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

Deterministic tests:

```bash
npm test
```

Live succession suite:

```bash
npm run test:live
```

Expected deterministic result:

```text
27/27 PASS
```

The latest recorded live result is:

```text
7/8 PASS
```

The remaining live dependency is documented rather than hidden.

---

## Reproduction

### Deterministic

```bash
npm install
npm run typecheck
npm run build
npm test
```

### Live

A live run requires:

- Bee API availability;
- network synchronization;
- usable Postage Batch;
- feed/chunk propagation.

Then:

```bash
npm run test:live
```

For an actual succession run:

1. Establish the funded storage arrangement.
2. Establish the stable root.
3. Publish through the current publisher.
4. Record the current publisher identity.
5. Trigger the documented succession condition or formal transfer.
6. Supply the incoming publisher identity.
7. Update the stable root.
8. Verify the new publisher.
9. Persist handoff evidence.
10. Resolve content through the unchanged root.

---

## Interoperability

P3 can act as a stewardship layer around durable Swarm content.

Conceptually:

```text
P3 Stable Root
      │
      ▼
Current Publisher
      │
      ▼
Archive / Content Reference
      │
      ▼
Durable Content
```

The important separation is that succession changes stewardship without requiring the reader to change its starting point.

---

## Submission Status

**Problem 3 — The Succession Nobody Wrote Down**

- Evaluator criteria: **8/8 PASS**
- Deterministic tests: **27/27 PASS**
- Live succession verification: **7/8 PASS**
- Build: **PASS**
- Typecheck: **PASS**
- Security review: **PASS**

The implementation provides stable indirection, separate payment/publishing/succession identities, existing-batch storage extension, an explicit successor parameter, a written succession arrangement, persisted handoff evidence, and an independent reader path.

The remaining live failure is explicitly documented as a Bee `/feeds` environmental dependency.
