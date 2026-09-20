// Hand-off evidence for the live succession flow (P3-T5). Written ONLY by the
// real live hand-off test after a verified transfer; never fabricated. Contains
// public identities and network-observed values only — no private keys, no .env
// values, no batch secrets.

import { readFile, writeFile } from 'node:fs/promises';

const ADDRESS_RE = /^0x[0-9a-f]{40}$/;
const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export type HandOffStatus = 'completed';

/**
 * A completed, verified A -> B succession hand-off. `entrypoint.verified` is
 * true only when a reader resolved the SAME stable (authorityOwner, rootTopic)
 * entrypoint to the incoming publisher's content after the transfer.
 */
export interface HandOffEvidenceRecord {
  format: 'swanloops-hand-off-evidence';
  version: 1;
  status: 'completed';
  authorityOwner: string;
  previousPublisher: string;
  nextPublisher: string;
  nonceAfter: number;
  /** Network-observed root feed index immediately after the hand-off write. */
  feedIndexAfter: string;
  timestamp: string;
  rootTopic: string;
  contentTopic: string;
  entrypoint: {
    authorityOwner: string;
    rootTopic: string;
    resolvedPublisher: string;
    verified: boolean;
  };
}

export interface BuildHandOffEvidenceInput {
  authorityOwner: string;
  previousPublisher: string;
  nextPublisher: string;
  nonceAfter: number;
  feedIndexAfter: string;
  timestamp: string;
  rootTopic: string;
  contentTopic: string;
  resolvedPublisher: string;
  verified: boolean;
}

function normalizeAddress(addr: string): string {
  return addr.toLowerCase();
}

export function buildHandOffEvidenceRecord(input: BuildHandOffEvidenceInput): HandOffEvidenceRecord {
  const authorityOwner = normalizeAddress(input.authorityOwner.trim());
  const previousPublisher = normalizeAddress(input.previousPublisher.trim());
  const nextPublisher = normalizeAddress(input.nextPublisher.trim());

  for (const [label, value] of Object.entries({
    authorityOwner,
    previousPublisher,
    nextPublisher,
  })) {
    if (!ADDRESS_RE.test(value)) {
      throw new Error(`Hand-off evidence requires a 0x-prefixed 40-hex ${label}, got: ${value}`);
    }
  }
  if (previousPublisher === nextPublisher) {
    throw new Error('Hand-off evidence requires OLD and NEW stewards to be distinct.');
  }
  if (authorityOwner === previousPublisher || authorityOwner === nextPublisher) {
    throw new Error('Hand-off evidence requires the succession authority to be distinct from both stewards.');
  }
  if (!Number.isInteger(input.nonceAfter) || input.nonceAfter < 0) {
    throw new Error(`Hand-off evidence requires a non-negative integer nonceAfter, got: ${String(input.nonceAfter)}`);
  }
  const feedIndexAfter = input.feedIndexAfter.trim();
  if (feedIndexAfter === '' || /[^0-9]/.test(feedIndexAfter)) {
    throw new Error(`Hand-off evidence requires a numeric feedIndexAfter, got: ${String(input.feedIndexAfter)}`);
  }
  const timestamp = input.timestamp.trim();
  if (!ISO_TS_RE.test(timestamp)) {
    throw new Error(`Hand-off evidence requires an ISO timestamp, got: ${timestamp}`);
  }
  const rootTopic = input.rootTopic.trim();
  const contentTopic = input.contentTopic.trim();
  if (rootTopic === '' || contentTopic === '') {
    throw new Error('Hand-off evidence requires a root topic and a content topic.');
  }
  if (!input.verified) {
    throw new Error('Hand-off evidence can only be marked completed after reader verification succeeds.');
  }
  const resolvedPublisher = normalizeAddress(input.resolvedPublisher.trim());
  if (resolvedPublisher !== nextPublisher) {
    throw new Error('Hand-off evidence entrypoint must resolve to the NEW steward for a completed hand-off.');
  }
  return {
    format: 'swanloops-hand-off-evidence',
    version: 1,
    status: 'completed',
    authorityOwner,
    previousPublisher,
    nextPublisher,
    nonceAfter: input.nonceAfter,
    feedIndexAfter,
    timestamp,
    rootTopic,
    contentTopic,
    entrypoint: {
      authorityOwner,
      rootTopic,
      resolvedPublisher,
      verified: true,
    },
  };
}

export async function persistHandOffEvidence(record: HandOffEvidenceRecord, filePath: string): Promise<void> {
  const json = JSON.stringify(record, null, 2) + '\n';
  await writeFile(filePath, json, 'utf8');
}

/** Read + validate the persisted hand-off evidence. `null` when the file does not exist. */
export async function loadHandOffEvidence(filePath: string): Promise<HandOffEvidenceRecord | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch {
    return null;
  }
  const parsed = JSON.parse(raw) as HandOffEvidenceRecord;
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('Hand-off evidence file has unexpected shape.');
  }
  const entrypoint = (parsed as { entrypoint?: Record<string, unknown> }).entrypoint;
  if (entrypoint === null || typeof entrypoint !== 'object') {
    throw new Error('Hand-off evidence file has unexpected shape: missing entrypoint.');
  }
  return buildHandOffEvidenceRecord({
    authorityOwner: parsed.authorityOwner,
    previousPublisher: parsed.previousPublisher,
    nextPublisher: parsed.nextPublisher,
    nonceAfter: parsed.nonceAfter,
    feedIndexAfter: parsed.feedIndexAfter,
    timestamp: parsed.timestamp,
    rootTopic: parsed.rootTopic,
    contentTopic: parsed.contentTopic,
    resolvedPublisher: parsed.entrypoint.resolvedPublisher,
    verified: parsed.entrypoint.verified === true,
  });
}

/** A run record persisted when a live hand-off run STARTS, so the generated identities survive the process. */
export interface HandOffRunRecord {
  format: 'swanloops-hand-off-run';
  version: 1;
  status: 'in-progress';
  startedAt: string;
  runId: string;
  rootTopic: string;
  contentTopic: string;
  authorityOwner: string;
  previousPublisher: string;
  incomingPublisher: string;
}

export async function persistHandOffRun(record: HandOffRunRecord, filePath: string): Promise<void> {
  const json = JSON.stringify(record, null, 2) + '\n';
  await writeFile(filePath, json, 'utf8');
}