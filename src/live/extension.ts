// Live PostageExtensionPort adapter. Top-up / extendDuration only — the shared
// batch is IMMUTABLE (immutableFlag true), so extending size (dilute) is never
// attempted; the same configured batch id is always reused, never a fresh rebuy.

import { Bee, Duration } from '@ethersphere/bee-js';
import type { PostageExtensionPort } from '../storage/extension.js';

export function createPostageExtensionPort(beeUrl: string): PostageExtensionPort {
  const bee = new Bee(beeUrl);

  return {
    async status(batchId: string): Promise<{ usable: boolean; durationMs: number | null }> {
      const batch = await bee.stamp.get(batchId);
      const durationMs = batch.duration ? batch.duration.toSeconds() * 1000 : null;
      return { usable: batch.usable, durationMs };
    },

    async extend(batchId: string, _size: number, durationMs: number): Promise<unknown> {
      // Immutable batch: extend duration only (relative), never dilute (extendSize).
      const duration = Duration.fromMilliseconds(durationMs);
      return bee.storage.extendDuration(batchId, duration);
    },

    async topUp(batchId: string, amount: number): Promise<unknown> {
      // amount is in PLUR; give bee-js a plain decimal string.
      return bee.stamp.topUp(batchId, amount.toString());
    },
  };
}