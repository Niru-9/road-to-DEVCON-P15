import { describe, it, expect } from 'vitest';
import { resolveIdentity, assertDistinct, normalizeKeyHex } from '../src/identity.js';
import { IdentityCollisionError } from '../src/errors.js';
import { assertDistinctRoles, loadSuccessionConfig } from '../src/config.js';

// Fixed distinct 32-byte test keys (never used in production).
const KEY_PUBLISHER = '11'.repeat(32);
const KEY_AUTHORITY = '22'.repeat(32);

describe('identity separation (P3-T2, P3-T6)', () => {
  it('derives distinct public owners from distinct private keys', () => {
    const a = resolveIdentity(KEY_PUBLISHER);
    const b = resolveIdentity(KEY_AUTHORITY);
    expect(a.owner).not.toBe(b.owner);
    expect(a.owner).toMatch(/^0x[0-9a-f]{128}$/);
    expect(b.owner).toMatch(/^0x[0-9a-f]{128}$/);
  });

  it('PUBLISHER and AUTHORITY keys are never allowed to collide', () => {
    const a = resolveIdentity(KEY_PUBLISHER);
    const b = resolveIdentity(KEY_PUBLISHER);
    expect(() => assertDistinct(a, 'PUBLISHER', b, 'AUTHORITY')).toThrow(IdentityCollisionError);
  });

  it('the same derivation is deterministic (fresh per run, stable per key)', () => {
    expect(resolveIdentity(KEY_PUBLISHER).owner).toBe(resolveIdentity(KEY_PUBLISHER).owner);
  });

  it('normalizes 0x-prefixed and bare hex to the same identity', () => {
    const a = resolveIdentity('0x' + KEY_PUBLISHER);
    const b = resolveIdentity(KEY_PUBLISHER);
    expect(a.owner).toBe(b.owner);
    expect(normalizeKeyHex('0x' + KEY_PUBLISHER)).toBe(normalizeKeyHex(KEY_PUBLISHER));
  });
});

describe('role distinctness at config load (P3-T2, P3-T6)', () => {
  const envFor = (overrides: Record<string, string>): Record<string, string> => ({
    BEE_URL: 'http://localhost:1633',
    PAYER_IDENTITY: '0x' + 'a0'.repeat(64),
    PUBLISHER_IDENTITY: '0x' + KEY_PUBLISHER,
    SUCCESSION_AUTHORITY_IDENTITY: '0x' + KEY_AUTHORITY,
    BATCH_ID: 'batch-1',
    ...overrides,
  });

  it('accepts three distinct identities', () => {
    const config = loadSuccessionConfig(envFor({}));
    expect(config.batchId).toBe('batch-1');
    expect(() => assertDistinctRoles(config)).not.toThrow();
  });

  it('rejects a payer == publisher collision', () => {
    // Collision must use the DERIVED publisher owner, otherwise it is not a real collision.
    const publisherOwner = resolveIdentity(KEY_PUBLISHER).owner;
    const config = loadSuccessionConfig(envFor({ PAYER_IDENTITY: publisherOwner }));
    expect(() => assertDistinctRoles(config)).toThrow(IdentityCollisionError);
  });

  it('rejects a publisher == authority collision', () => {
    const config = loadSuccessionConfig(envFor({ SUCCESSION_AUTHORITY_IDENTITY: '0x' + KEY_PUBLISHER }));
    expect(() => assertDistinctRoles(config)).toThrow(IdentityCollisionError);
  });
});