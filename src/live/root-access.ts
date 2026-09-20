// Live RootAccess adapter: the root feed is an Ethereum-address-owned swarm feed
// whose payload is a JSON pointer record (publisher, topic, nonce) published as a
// content-addressed reference. Empty feed -> RootUnresolvableError (fresh init).

import { Bee, BeeResponseError, FeedIndex, PrivateKey, Reference, Topic } from '@ethersphere/bee-js';
import type { RootAccess, RootPointerRecord } from '../authority/root.js';
import { RootUnresolvableError } from '../errors.js';
import { bytesToUtf8, delay, downloadBytes, uploadBytes, utf8ToBytes, withRetry } from './bee.js';
import { feedOwnerOf } from './identity.js';

// The write path awaits bee's own push/sync before returning, but a just-written
// feed chunk can take a while to become retrievable from the network on a light
// node. Bounded propagation wait: poll every 500ms for up to 30s. On this node a
// brand-new SOC can also transiently 500 on GET /chunks before it fully settles,
// so a write is only acknowledged after a settling window of consistent reads.
const PROPAGATION_RETRY_INTERVAL_MS = 500;
const PROPAGATION_TIMEOUT_MS = 30_000;
// Number of consecutive, correct, no-index latest-reads required before a write
// is acknowledged, and the minimum spacing between them.
const LATEST_CONTINUITY_READS = 3;
const LATEST_READ_GAP_MS = 750;

export interface LiveRootAccessOptions {
  beeUrl: string;
  batchId: string;
  signer: PrivateKey;
  rootTopic: string;
}

export function createRootAccess(opts: LiveRootAccessOptions): RootAccess {
  const { beeUrl, batchId, signer, rootTopic } = opts;
  const feedOwner = feedOwnerOf(signer);
  const rootTopicHash = Topic.fromString(rootTopic);

  const bee = new Bee(beeUrl);

  // Mirrors bee-js findNextIndex (feed/index.js): resolve the next update index
  // from the FEED NETWORK STATE (the latest /feeds lookup), treating an empty or
  // unreachable-on-404 feed as "next index is 0".
  async function resolveNextIndex(): Promise<FeedIndex> {
    const reader = bee.feed.makeReader(rootTopicHash, feedOwner);
    try {
      const update = await reader.download();
      if (!update.feedIndexNext) {
        throw new Error('Feed index next is not defined. This should happen when fetching an exact index.');
      }
      return update.feedIndexNext;
    } catch (err) {
      if (err instanceof BeeResponseError) {
        return FeedIndex.fromBigInt(0n);
      }
      throw err;
    }
  }

  return {
    async readRoot(): Promise<RootPointerRecord> {
      const reader = bee.feed.makeReader(rootTopicHash, feedOwner);
      let reference: string;
      try {
        const update = await withRetry(() => reader.downloadReference(), 4, 300, 'read root feed');
        reference = update.reference.toHex();
      } catch (err) {
        throw new RootUnresolvableError(
          `Root feed is empty or unreachable (owner=${feedOwner}, topic=${rootTopic}).`,
          { cause: err },
        );
      }
      const raw = bytesToUtf8(await downloadBytes(bee, reference));
      let record: unknown;
      try {
        record = JSON.parse(raw);
      } catch {
        throw new RootUnresolvableError(`Root feed payload at ${reference} is not valid JSON.`);
      }
      if (!isPointerRecord(record)) {
        throw new RootUnresolvableError(`Root feed payload at ${reference} is not a pointer record.`);
      }
      return record;
    },

    async writeRoot(record: RootPointerRecord): Promise<{ reference: string; feedIndex: string }> {
      const reference = await uploadBytes(bee, batchId, utf8ToBytes(JSON.stringify(record)));
      // Resolve the next Feed index from the CURRENT network state before writing.
      const nextIndex = await resolveNextIndex();
      const writer = bee.feed.makeWriter(rootTopicHash, signer);
      await writer.uploadReference(batchId, reference, { index: nextIndex, deferred: true });
      // Verify the exact update at the SAME index (deterministic GET /chunks).
      const reader = bee.feed.makeReader(rootTopicHash, feedOwner);
      const exact = await withFeedPropagationRetry(async () => reader.downloadReference({ index: nextIndex }));
      // Confirm the network's LATEST lookup (no explicit index) durably points at
      // the chunk we just wrote. Readers/evaluators resolve "latest" by probing
      // the /feeds state, whose index lags a deferred write, and a brand-new SOC
      // can transiently fail on GET /chunks while it is still being seeded on the
      // node. A write is only acknowledged once that exact read has stayed correct
      // for a settling window, so the announcement is exposed neither as a stale
      // index nor as a 404/500.
      await confirmDurableLatest(reader, nextIndex, new Reference(reference));
      return { reference, feedIndex: exact.feedIndex.toBigInt().toString() };
    },
  };
}

function isPointerRecord(value: unknown): value is RootPointerRecord {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return typeof obj['publisher'] === 'string' && typeof obj['topic'] === 'string' && typeof obj['nonce'] === 'number';
}

/**
 * Poll an operation until the network makes the just-written chunk retrievable.
 * A freshly written (deferred) feed chunk is not atomic: the probe/read can
 * transiently fail while the SOC is being seeded. Both 404 (not yet found) and
 * 500 (retrieval of the brand-new chunk not yet possible) are expected in that
 * aperture; any other error fails immediately. Bounded: every 500ms for up to
 * PROPAGATION_TIMEOUT_MS.
 */
async function withFeedPropagationRetry<T>(fn: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransientFeedReadError(err)) throw err;
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs >= PROPAGATION_TIMEOUT_MS) {
        throw new Error(
          `Root feed chunk did not propagate within ${PROPAGATION_TIMEOUT_MS}ms (elapsed ${elapsedMs}ms); ` +
            `write succeeded but the chunk is still unreachable from the network.`,
          { cause: err },
        );
      }
      await delay(PROPAGATION_RETRY_INTERVAL_MS);
    }
  }
}

function isTransientFeedReadError(err: unknown): boolean {
  return (
    err instanceof StaleFeedReadError ||
    (err instanceof BeeResponseError && (err.status === 404 || err.status === 500))
  );
}

/**
 * The reader resolves "latest" from the /feeds NETWORK STATE (probe) then reads
 * the SOC chunk at that index. A write is only durable once LATEST_CONTINUITY_READS
 * consecutive no-index reads all resolve without error, report the index we wrote,
 * and report the reference we wrote, spaced over a settling window. Any transient
 * 404/500 or any stale/mismatched value means the announcement is still in flight
 * and the whole window restarts. Bounded by PROPAGATION_TIMEOUT_MS.
 */
async function confirmDurableLatest(
  reader: ReturnType<Bee['feed']['makeReader']>,
  expectedIndex: FeedIndex,
  expectedReference: Reference,
): Promise<void> {
  const startedAt = Date.now();
  let consecutive = 0;
  let lastErr: unknown;
  for (;;) {
    try {
      const update = await reader.downloadReference();
      const indexMatches = update.feedIndex.toBigInt() === expectedIndex.toBigInt();
      const referenceMatches = update.reference.toHex() === expectedReference.toHex();
      if (!indexMatches || !referenceMatches) {
        throw new StaleFeedReadError(
          `Latest feed lookup lags the write (visible index=${update.feedIndex.toBigInt()}, ` +
            `expected=${expectedIndex.toBigInt()}); announcement not yet durable.`,
        );
      }
      consecutive += 1;
      if (consecutive >= LATEST_CONTINUITY_READS) return;
    } catch (err) {
      if (!isTransientFeedReadError(err)) throw err;
      consecutive = 0;
      lastErr = err;
    }
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= PROPAGATION_TIMEOUT_MS) {
      throw new Error(
        `Root feed announcement did not become durably readable within ${PROPAGATION_TIMEOUT_MS}ms ` +
          `(elapsed ${elapsedMs}ms); this node is not serving the just-written update.`,
        { cause: lastErr },
      );
    }
    await delay(LATEST_READ_GAP_MS);
  }
}

/** A successful read that still does not reflect the just-written update. */
class StaleFeedReadError extends Error {}