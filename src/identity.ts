// Identity handling. Private keys come only from the environment; public feed
// identities are derived fresh each run from the key material.

import { PrivateKey } from '@ethersphere/bee-js';
import { IdentityCollisionError } from './errors.js';

export interface ResolvedIdentity {
  /** 0x-prefixed public key hex (the feed owner address). */
  owner: string;
  /** The signer object used by bee.feed.makeWriter. */
  signer: PrivateKey;
}

export function normalizeKeyHex(privateKeyHex: string): string {
  return privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex;
}

/** Derive the public feed owner from a private key (fresh every call). */
export function resolveIdentity(privateKeyHex: string): ResolvedIdentity {
  const normalized = normalizeKeyHex(privateKeyHex);
  const signer = new PrivateKey(normalized);
  return { owner: '0x' + signer.publicKey().toHex(), signer };
}

export function assertDistinct(a: ResolvedIdentity, aRole: string, b: ResolvedIdentity, bRole: string): void {
  if (a.owner === b.owner) {
    throw new IdentityCollisionError(`${aRole} and ${bRole} must be distinct identities.`);
  }
}