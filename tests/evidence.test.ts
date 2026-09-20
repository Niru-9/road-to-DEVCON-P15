import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHandOffEvidenceRecord, loadHandOffEvidence } from '../src/live/evidence.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const evidencePath = join(root, 'docs', 'hand-off-evidence.json');

const A = '0x' + 'aa'.repeat(20);
const B = '0x' + 'bb'.repeat(20);
const AUTHORITY = '0x' + 'cc'.repeat(20);

const complete = {
  authorityOwner: AUTHORITY,
  previousPublisher: A,
  nextPublisher: B,
  nonceAfter: 1,
  feedIndexAfter: '2',
  timestamp: '2026-09-20T00:00:00.000Z',
  rootTopic: 'swanloops-live-probe',
  contentTopic: 'preserve-catalogue-probe',
  resolvedPublisher: B,
  verified: true,
};

describe('recorded hand-off evidence (P3-T5)', () => {
  it('the tracked artifact describes a real, verified, completed A -> B hand-off', async () => {
    const record = await loadHandOffEvidence(evidencePath);
    expect(record).not.toBeNull();
    if (record === null) return;
    expect(record.status).toBe('completed');
    expect(record.previousPublisher).toMatch(/^0x[0-9a-f]{40}$/);
    expect(record.nextPublisher).toMatch(/^0x[0-9a-f]{40}$/);
    expect(record.previousPublisher.toLowerCase()).not.toBe(record.nextPublisher.toLowerCase());
    expect(record.authorityOwner.toLowerCase()).not.toBe(record.previousPublisher.toLowerCase());
    expect(record.authorityOwner.toLowerCase()).not.toBe(record.nextPublisher.toLowerCase());
    expect(record.feedIndexAfter).toBeTruthy();
    expect(/^[0-9]+$/.test(record.feedIndexAfter)).toBe(true);
    expect(record.nonceAfter).toBeGreaterThan(0);
    expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(record.rootTopic).toBeTruthy();
    expect(record.contentTopic).toBeTruthy();
    expect(record.entrypoint.verified).toBe(true);
    expect(record.entrypoint.rootTopic).toBe(record.rootTopic);
    expect(record.entrypoint.resolvedPublisher.toLowerCase()).toBe(record.nextPublisher.toLowerCase());
  });

  it('the artifact file carries public data only (no key material)', () => {
    const text = readFileSync(evidencePath, 'utf8');
    expect(text).not.toMatch(/[0-9a-f]{64}/i);
    expect(text).not.toMatch(/PRIVATE_KEY|private[ -]?key|mnemonic|gift ?code|seed phrase|BEGIN PRIVATE KEY/i);
  });

  it('rejects fabricated or incomplete evidence records', () => {
    expect(() => buildHandOffEvidenceRecord({ ...complete, feedIndexAfter: '' })).toThrow();
    expect(() => buildHandOffEvidenceRecord({ ...complete, previousPublisher: B, nextPublisher: B })).toThrow();
    expect(() => buildHandOffEvidenceRecord({ ...complete, authorityOwner: B })).toThrow();
    expect(() => buildHandOffEvidenceRecord({ ...complete, verified: false })).toThrow();
    expect(() => buildHandOffEvidenceRecord({ ...complete, resolvedPublisher: A })).toThrow();
    expect(() => buildHandOffEvidenceRecord({ ...complete, timestamp: 'not-a-timestamp' })).toThrow();
    expect(buildHandOffEvidenceRecord(complete).status).toBe('completed');
  });
});