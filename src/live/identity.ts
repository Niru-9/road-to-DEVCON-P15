// Live identity bridge. The deterministic layer uses a 64-byte public key as the
// publisher owner, but bee feeds are owned by a 20-byte Ethereum address. This
// adapter derives the 0x-prefixed 40-hex EIP-55-style (lowercase) feed owner from
// a signer so RootPointerRecord.publisher, ContentFeedPort.owner(), and the feed
// owner passed to makeReader all agree — making publishUnderPublisher's exact
// string match truthful on the live path.

import { PrivateKey } from '@ethersphere/bee-js';

/** 0x-prefixed lowercase 20-byte address used as the feed owner. */
export function feedOwnerOf(signer: PrivateKey): string {
  return '0x' + signer.publicKey().address().toHex();
}

/** Derive a signer from an optional 0x-prefixed private key hex. */
export function toSigner(privateKeyHex: string): PrivateKey {
  const normalized = privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex;
  return new PrivateKey(normalized);
}