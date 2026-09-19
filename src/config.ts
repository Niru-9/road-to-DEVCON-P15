// Configuration. Three distinct identities: payer (funds storage), publisher
// (signs the content feed), succession authority (signs the root pointer).
// Private keys live only in the environment; public identities are derived fresh
// from the keys at load so role distinctness is enforced immediately (P3-T2, P3-T6).

import { ConfigError, IdentityCollisionError } from './errors.js';
import { resolveIdentity } from './identity.js';

export interface RoleSecret {
  /** Short role label for error messages. */
  role: string;
  /** Private key hex (0x-prefixed or not). */
  privateKey?: string;
  /** Derived public identity (0x-prefixed hex). Filled at load. */
  publicIdentity?: string;
}

export interface SuccessionConfig {
  beeUrl: string;
  /** Public address of the node wallet that funds the batch. */
  payer: { role: 'PAYER'; publicIdentity: string };
  /** Private key that signs the publisher content feed. */
  publisher: RoleSecret & { role: 'PUBLISHER' };
  /** Private key that signs the root succession feed. */
  authority: RoleSecret & { role: 'AUTHORITY' };
  /** Existing postage batch targeted by storage extension. */
  batchId: string;
  /** Topic of the root succession feed. */
  rootTopic: string;
}

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new ConfigError(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

/** Assert the three roles are pairwise distinct, else reject at load (P3-T2, P3-T6). */
export function assertDistinctRoles(config: SuccessionConfig): void {
  const payerId = config.payer.publicIdentity;
  const publisherId = config.publisher.publicIdentity;
  const authorityId = config.authority.publicIdentity;
  if (!payerId || !publisherId || !authorityId) {
    throw new ConfigError('Not all identities are resolved; cannot enforce role distinctness.');
  }
  if (sameOwner(payerId, publisherId)) {
    throw new IdentityCollisionError('PAYER and PUBLISHER must be distinct identities.');
  }
  if (sameOwner(payerId, authorityId)) {
    throw new IdentityCollisionError('PAYER and AUTHORITY must be distinct identities.');
  }
  if (sameOwner(publisherId, authorityId)) {
    throw new IdentityCollisionError('PUBLISHER and AUTHORITY must be distinct identities.');
  }
}

function sameOwner(a: string, b: string): boolean {
  const normalize = (owner: string): string => (owner.startsWith('0x') ? owner.slice(2) : owner).toLowerCase();
  return normalize(a) === normalize(b);
}

export function loadSuccessionConfig(env: Record<string, string | undefined> = process.env): SuccessionConfig {
  const publisherKey = required('PUBLISHER_IDENTITY', env['PUBLISHER_IDENTITY']);
  const authorityKey = required('SUCCESSION_AUTHORITY_IDENTITY', env['SUCCESSION_AUTHORITY_IDENTITY']);
  const config: SuccessionConfig = {
    beeUrl: required('BEE_URL', env['BEE_URL']),
    payer: { role: 'PAYER', publicIdentity: required('PAYER_IDENTITY', env['PAYER_IDENTITY']) },
    publisher: {
      role: 'PUBLISHER',
      privateKey: publisherKey,
      publicIdentity: resolveIdentity(publisherKey).owner,
    },
    authority: {
      role: 'AUTHORITY',
      privateKey: authorityKey,
      publicIdentity: resolveIdentity(authorityKey).owner,
    },
    batchId: required('BATCH_ID', env['BATCH_ID']),
    rootTopic: env['ROOT_TOPIC']?.trim() || 'succession-pointer',
  };
  return config;
}