// Succession transfer (P3-T8, P3-T5). The incoming publisher is always passed as
// a parameter — never a hardcoded successor. The authority writes the new pointer;
// the result is the evidence record of a real hand-off.

import type { RootAccess, RootPointerRecord } from './root.js';
import { NoOpTransferError } from '../errors.js';

export interface TransferEvidence {
  previousPublisher: string;
  nextPublisher: string;
  nonceAfter: number;
  /** Feed index after the write (evidence that the update landed). */
  feedIndexAfter?: string;
  timestamp: string;
}

export interface TransferInput {
  incomingPublisher: string;
  currentNonce: number;
  /** Publisher content topic carries over across hand-offs. */
  contentTopic: string;
  now?: () => string;
}

/**
 * Transfer stewardship to `incomingPublisher`. Rejects a no-op (same publisher),
 * bumps the nonce so the hand-off is observable, and returns evidence.
 */
export async function transferPublisher(
  access: RootAccess,
  input: TransferInput,
): Promise<{ evidence: TransferEvidence; pointer: RootPointerRecord }> {
  const current: RootPointerRecord = await access.readRoot();
  if (normalizeAddress(current.publisher) === normalizeAddress(input.incomingPublisher)) {
    throw new NoOpTransferError('Incoming publisher equals the current publisher; refusing a no-op transfer.');
  }
  const nextPointer: RootPointerRecord = {
    publisher: input.incomingPublisher,
    topic: input.contentTopic,
    nonce: Math.max(current.nonce, input.currentNonce) + 1,
  };
  const written = await access.writeRoot(nextPointer);
  const evidence: TransferEvidence = {
    previousPublisher: current.publisher,
    nextPublisher: input.incomingPublisher,
    nonceAfter: nextPointer.nonce,
    timestamp: (input.now ?? (() => new Date().toISOString()))(),
  };
  const feedIndexAfter = extractIndex(written);
  if (feedIndexAfter !== undefined) evidence.feedIndexAfter = feedIndexAfter;
  return { evidence, pointer: nextPointer };
}

function normalizeAddress(addr: string): string {
  const lower = addr.toLowerCase();
  return lower.startsWith('0x') ? lower.slice(2) : lower;
}

function extractIndex(written: unknown): string | undefined {
  if (written === null || typeof written !== 'object') return undefined;
  const obj = written as Record<string, unknown>;
  const candidate = obj['feedIndex'] ?? obj['index'];
  if (typeof candidate === 'string') return candidate;
  if (typeof candidate === 'bigint') return candidate.toString();
  if (typeof candidate === 'number') return candidate.toString();
  if (candidate !== null && typeof candidate === 'object' && 'toString' in (candidate as object)) {
    return (candidate as { toString(): string }).toString();
  }
  return undefined;
}