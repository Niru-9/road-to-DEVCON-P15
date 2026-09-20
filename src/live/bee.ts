// Live Bee client helpers. The node is contacted only through the official
// bee-js client; nothing here hardcodes references, stamps, or identities.

import { Bee, Bytes } from '@ethersphere/bee-js';
import { BatchUnusableError, ConfigError } from '../errors.js';

export function createBee(url: string): Bee {
  if (!url || url.trim() === '') {
    throw new ConfigError('Missing required environment variable: BEE_URL');
  }
  return new Bee(url.trim());
}

/** Assert the node answers a live health check; else the live demo cannot start. */
export async function assertBeeHealthy(bee: Bee): Promise<void> {
  const health = await bee.status.getHealth();
  if (health.status !== 'ok') {
    throw new BatchUnusableError(`Bee is unhealthy (status=${health.status}).`);
  }
}

export async function uploadBytes(bee: Bee, batchId: string, bytes: Uint8Array): Promise<string> {
  const upload = await bee.data.upload(batchId, bytes);
  return upload.reference.toHex();
}

export async function downloadBytes(bee: Bee, reference: string): Promise<Uint8Array> {
  const bytes = await bee.data.download(reference);
  return bytes.toUint8Array();
}

export function utf8ToBytes(text: string): Uint8Array {
  return Bytes.fromUtf8(text).toUint8Array();
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** Retry a feed read a handful of times; local SOC writes settle fast but are not atomic. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 12, delayMs = 300, label = 'op'): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr as Error;
}

export const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));