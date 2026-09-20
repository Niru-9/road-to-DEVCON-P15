// LIVE succession test (P3 Phase B). Proves the deterministic architecture
// against the REAL local Bee node (node_modules, no mocks, no stubs):
//
//   P3-01 payer separate:    paying wallet is a distinct identity.
//   P3-02 publisher signs:   content A under steward A, content B under steward B.
//   P3-03 same-batch:        storage extended on the SAME existing batch via real
//                            top-up (immutable batch: never dilute, never re-buy).
//   P3-04 stable entrypoint: reader's (authorityOwner, rootTopic) never changes,
//                            yet content rotates A -> B.
//   P3-05 hand-off evidence: feedIndexAfter read from the live root feed,
//                            OLD != NEW, timestamped.
//   P3-06 authority role:    the root chunk is owned/signed by the authority key
//                            (readable under the authority, absent under steward A).
//   P3-08 fresh init:        a brand-new root topic is EMPTY (readRoot throws);
//                            state is created on-chain, never assumed.

import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { Bee, Duration, Topic, Utils } from '@ethersphere/bee-js';
import { loadSuccessionConfig } from '../../src/config.js';
import { createRootAccess } from '../../src/live/root-access.js';
import { createContentFeedPort } from '../../src/live/content-feed.js';
import { createContentReader } from '../../src/live/content-reader.js';
import { createPostageExtensionPort } from '../../src/live/extension.js';
import { feedOwnerOf, toSigner } from '../../src/live/identity.js';
import { uploadBytes, utf8ToBytes, bytesToUtf8 } from '../../src/live/bee.js';
import { publishUnderPublisher } from '../../src/publisher/publisher.js';
import { transferPublisher } from '../../src/authority/transfer.js';
import type { TransferEvidence } from '../../src/authority/transfer.js';
import { readThroughStableEntrypoint } from '../../src/reader/reader.js';
import { extendExistingStorage } from '../../src/storage/extension.js';
import { RootUnresolvableError } from '../../src/errors.js';
import {
  buildHandOffEvidenceRecord,
  loadHandOffEvidence,
  persistHandOffEvidence,
  persistHandOffRun,
} from '../../src/live/evidence.js';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));

let bee: Bee;
let batchId: string;
let capturedEvidence: TransferEvidence | null = null;

const ctx = {
  authorityOwner: '',
  rootTopic: '',
  contentTopic: '',
  stewardA: '',
  stewardB: '',
  payerIdentity: '',
};

// Content published by steward A and steward B. Real, distinct UTF-8 bytes.
const contentA = JSON.stringify({ catalogue: 'Deccan-manuscripts', steward: 'A', id: 'p3-live-A', at: new Date().toISOString() });
const contentB = JSON.stringify({ catalogue: 'Deccan-manuscripts', steward: 'B', id: 'p3-live-B', at: new Date().toISOString() });

function signerAuthority(): ReturnType<typeof toSigner> {
  return toSigner(loadSuccessionConfig(process.env).authority.privateKey!);
}

beforeAll(async () => {
  try {
    process.loadEnvFile(`${projectRoot}.env`);
  } catch {
    // config loader below reads whatever env vitest already has
  }

  const cfg = loadSuccessionConfig(process.env);
  batchId = cfg.batchId;

  const signerA = toSigner(cfg.publisher.privateKey!);
  const signerB = toSigner(process.env['INCOMING_PUBLISHER_IDENTITY']!);
  const signerAuthority = toSigner(cfg.authority.privateKey!);

  ctx.stewardA = feedOwnerOf(signerA);
  ctx.stewardB = feedOwnerOf(signerB);
  ctx.authorityOwner = feedOwnerOf(signerAuthority);
  ctx.payerIdentity = cfg.payer.publicIdentity;

  // FRESH, unused topics each run so "fresh init" is genuinely empty.
  const runId = Date.now().toString(36);
  ctx.rootTopic = `swanloops-live-${runId}`;
  ctx.contentTopic = `preserve-catalogue-${runId}`;

  // P3-T5: record the generated identities immediately so the run is traceable
  // even if the process dies before the hand-off completes. Public data only.
  await persistHandOffRun(
    {
      format: 'swanloops-hand-off-run',
      version: 1,
      status: 'in-progress',
      startedAt: new Date().toISOString(),
      runId,
      rootTopic: ctx.rootTopic,
      contentTopic: ctx.contentTopic,
      authorityOwner: ctx.authorityOwner,
      previousPublisher: ctx.stewardA,
      incomingPublisher: ctx.stewardB,
    },
    join(projectRoot, 'docs', 'handoff-run.json'),
  );

  bee = new Bee(cfg.beeUrl);

  const health = await bee.status.getHealth();
  if (health.status !== 'ok') throw new Error(`Bee unhealthy: ${health.status}`);

  const batch = await bee.stamp.get(batchId);
  if (!batch.usable) throw new Error(`Configured batch ${batchId} is not usable.`);
});

async function pollBatchAmountIncrease(
  batchId: string,
  beforeAmount: bigint,
  attempts = 90,
  delayMs = 1000,
): Promise<Awaited<ReturnType<typeof bee.stamp.get>>> {
  const startedAt = Date.now();
  for (let i = 0; i < attempts; i += 1) {
    const batch = await bee.stamp.get(batchId);
    if (BigInt(batch.amount) > beforeAmount) return batch;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  const last = await bee.stamp.get(batchId);
  throw new Error(
    `P3-03: batch ${batchId} amount did not increase within ${Math.round((Date.now() - startedAt) / 1000)}s ` +
      `(before ${beforeAmount} PLUR, last ${BigInt(last.amount)} PLUR).`,
  );
}

describe('P3-01 payer is a distinct identity from the stewardship roles', () => {
  it('wallet address (payer) matches the configured PAYER_IDENTITY', async () => {
    const balance = await bee.wallet.getBalance();
    expect(balance.walletAddress.toLowerCase()).toBe(ctx.payerIdentity.toLowerCase());
  });

  it('payer is distinct from both steward A and steward B', () => {
    const payer = ctx.payerIdentity.toLowerCase();
    expect(payer).not.toBe(ctx.stewardA.toLowerCase());
    expect(payer).not.toBe(ctx.stewardB.toLowerCase());
  });
});

describe('P3-08 fresh init: a brand-new root topic is empty until written', () => {
  it('readRoot on a fresh root topic throws RootUnresolvableError (no fabricated state)', async () => {
    const root = createRootAccess({
      beeUrl: bee.url,
      batchId,
      signer: signerAuthority(),
      rootTopic: ctx.rootTopic,
    });
    await expect(root.readRoot()).rejects.toBeInstanceOf(RootUnresolvableError);
  });
});

describe('P3-06/02/07 init: authority owns the root; steward A signs and publishes content', () => {
  it('writes root -> steward A (authority key), then steward A publishes retrievable content', async () => {
    const root = createRootAccess({
      beeUrl: bee.url,
      batchId,
      signer: signerAuthority(),
      rootTopic: ctx.rootTopic,
    });

    const init = (await root.writeRoot({ publisher: ctx.stewardA, topic: ctx.contentTopic, nonce: 0 })) as {
      reference?: string;
      feedIndex?: string;
    };
    expect(init.feedIndex).toBeDefined();

    // Root chunk must live at the AUTHORITY identifier (signed by its key) and
    // must NOT exist under steward A's identifier.
    const asAuthority = bee.feed.makeReader(Topic.fromString(ctx.rootTopic), ctx.authorityOwner);
    await expect(asAuthority.downloadReference()).resolves.toBeDefined();
    const asStewardA = bee.feed.makeReader(Topic.fromString(ctx.rootTopic), ctx.stewardA);
    await expect(asStewardA.downloadReference()).rejects.toThrow();

    // Steward A signs its own content feed.
    const feedA = createContentFeedPort({
      beeUrl: bee.url,
      batchId,
      signer: toSigner(process.env['PUBLISHER_IDENTITY']!),
      topic: ctx.contentTopic,
    });
    const pointerA = { publisher: ctx.stewardA, topic: ctx.contentTopic, nonce: 0 };
    const contentRef = await uploadBytes(bee, batchId, utf8ToBytes(contentA));
    await publishUnderPublisher(pointerA, feedA, contentRef);

    // Reader with the SAME captured identifier resolves content A.
    const reader = createContentReader(bee.url);
    const viaEntrypoint = await readThroughStableEntrypoint(root, reader, {
      authorityOwner: ctx.authorityOwner,
      rootTopic: ctx.rootTopic,
    });
    expect(viaEntrypoint.pointer.publisher.toLowerCase()).toBe(ctx.stewardA.toLowerCase());
    expect(bytesToUtf8(viaEntrypoint.content)).toBe(contentA);
  });
});

describe('P3-03 storage is extended on the SAME existing batch (real top-up)', () => {
  it('top-ups the configured batch without re-buying or diluting it', async () => {
    const extension = createPostageExtensionPort(bee.url);

    const before = await bee.stamp.get(batchId);
    const balanceBefore = (await bee.wallet.getBalance()).bzzBalance.toPLURBigInt();

    const chain = await bee.status.getChainState();
    const amount = Utils.getAmountForDuration(Duration.fromSeconds(3600), chain.currentPrice, 5);

    const result = await extendExistingStorage(extension, batchId, { topUpAmount: Number(amount) });
    expect(result.batchId).toBe(batchId); // SAME id, never a fresh rebuy
    expect(result.toppedUp).toBe(true);
    expect(result.extended).toBe(false); // immutable batch, never extendSize/dilute

    // Top-up lands via a transaction (chain finality ~38s on this node); the batch
    // amount is the observed on-chain evidence. Wall-clock TTL/duration decays while
    // waiting, so confirm the top-up by polling the SAME batch until its amount grows.
    const after = await pollBatchAmountIncrease(batchId, BigInt(before.amount));
    const balanceAfter = (await bee.wallet.getBalance()).bzzBalance.toPLURBigInt();

    expect(after.batchID.toHex()).toBe(batchId); // same batch id survived, no rebuy
    expect(BigInt(after.amount)).toBeGreaterThan(BigInt(before.amount)); // on-chain top-up landed
    expect(after.duration.toSeconds()).toBeGreaterThan(0); // batch still has valid lifetime
    expect(balanceAfter).toBeLessThan(balanceBefore);
  });
});

describe('P3-05 hand-off: authority transfers stewardship to B with real evidence', () => {
  it('records OLD != NEW + feedIndexAfter from the live feed, then B publishes', async () => {
    const root = createRootAccess({
      beeUrl: bee.url,
      batchId,
      signer: signerAuthority(),
      rootTopic: ctx.rootTopic,
    });

    const { evidence, pointer } = await transferPublisher(root, {
      incomingPublisher: ctx.stewardB,
      currentNonce: 0,
      contentTopic: ctx.contentTopic,
    });

    expect(evidence.previousPublisher.toLowerCase()).toBe(ctx.stewardA.toLowerCase());
    expect(evidence.nextPublisher.toLowerCase()).toBe(ctx.stewardB.toLowerCase());
    expect(evidence.previousPublisher.toLowerCase()).not.toBe(evidence.nextPublisher.toLowerCase());
    expect(evidence.nonceAfter).toBe(1);
    expect(evidence.feedIndexAfter).toBeDefined();
    expect(evidence.timestamp).toBeTruthy();
    expect(pointer.publisher.toLowerCase()).toBe(ctx.stewardB.toLowerCase());
    capturedEvidence = evidence;

    const feedB = createContentFeedPort({
      beeUrl: bee.url,
      batchId,
      signer: toSigner(process.env['INCOMING_PUBLISHER_IDENTITY']!),
      topic: ctx.contentTopic,
    });
    const contentRef = await uploadBytes(bee, batchId, utf8ToBytes(contentB));
    await publishUnderPublisher(pointer, feedB, contentRef);
  });
});

describe('P3-04 the SAME reader identifier now resolves steward B', () => {
  it('content changes A -> B while the entrypoint never changes', async () => {
    const root = createRootAccess({
      beeUrl: bee.url,
      batchId,
      signer: signerAuthority(),
      rootTopic: ctx.rootTopic,
    });

    const reader = createContentReader(bee.url);
    const viaEntrypoint = await readThroughStableEntrypoint(root, reader, {
      authorityOwner: ctx.authorityOwner,
      rootTopic: ctx.rootTopic,
    });

    expect(viaEntrypoint.pointer.publisher.toLowerCase()).toBe(ctx.stewardB.toLowerCase());
    expect(bytesToUtf8(viaEntrypoint.content)).toBe(contentB);
  });
});

describe('P3-T5 the real hand-off evidence is persisted, never fabricated', () => {
  it('writes a non-secret evidence artifact for the completed A -> B hand-off', async () => {
    expect(capturedEvidence).not.toBeNull();
    const evidence = capturedEvidence!;
    expect(evidence.feedIndexAfter).toBeDefined();

    const root = createRootAccess({
      beeUrl: bee.url,
      batchId,
      signer: signerAuthority(),
      rootTopic: ctx.rootTopic,
    });
    const viaEntrypoint = await readThroughStableEntrypoint(root, createContentReader(bee.url), {
      authorityOwner: ctx.authorityOwner,
      rootTopic: ctx.rootTopic,
    });

    const record = buildHandOffEvidenceRecord({
      authorityOwner: ctx.authorityOwner,
      previousPublisher: evidence.previousPublisher,
      nextPublisher: evidence.nextPublisher,
      nonceAfter: evidence.nonceAfter,
      feedIndexAfter: evidence.feedIndexAfter!,
      timestamp: evidence.timestamp,
      rootTopic: ctx.rootTopic,
      contentTopic: ctx.contentTopic,
      resolvedPublisher: viaEntrypoint.pointer.publisher,
      verified: viaEntrypoint.pointer.publisher.toLowerCase() === ctx.stewardB.toLowerCase(),
    });

    const evidencePath = join(projectRoot, 'docs', 'hand-off-evidence.json');
    await persistHandOffEvidence(record, evidencePath);
    const loaded = await loadHandOffEvidence(evidencePath);
    expect(loaded).toEqual(record);
    expect(record.status).toBe('completed');
    expect(record.entrypoint.verified).toBe(true);
    expect(record.previousPublisher).not.toBe(record.nextPublisher);
  });
});