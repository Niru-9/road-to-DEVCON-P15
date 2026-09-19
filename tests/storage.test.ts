import { describe, it, expect } from 'vitest';
import { extendExistingStorage } from '../src/storage/extension.js';
import type { PostageExtensionPort } from '../src/storage/extension.js';
import { StorageExtensionError } from '../src/errors.js';

describe('storage extension targets the SAME existing batch (P3-T3)', () => {
  it('extends the configured batch id — no new batch is ever purchased', async () => {
    const extendedIds: string[] = [];
    const toppedUpIds: string[] = [];
    const seenIds: string[] = [];
    const port: PostageExtensionPort = {
      async status(batchId) {
        seenIds.push(batchId);
        return { usable: true, durationMs: 5 * 24 * 60 * 60 * 1000 };
      },
      async extend(batchId) {
        extendedIds.push(batchId);
      },
      async topUp(batchId) {
        toppedUpIds.push(batchId);
      },
    };
    const result = await extendExistingStorage(port, 'existing-batch-id', { size: 10, topUpAmount: 100 });
    expect(result.batchId).toBe('existing-batch-id');
    expect(extendedIds).toEqual(['existing-batch-id']);
    expect(toppedUpIds).toEqual(['existing-batch-id']);
    expect(seenIds).toEqual(['existing-batch-id']);
    // The extension primitive is never invoked with a different/fresh batch id.
    expect(extendedIds.every((id) => id === 'existing-batch-id')).toBe(true);
  });

  it('reports extended/toppedUp flags', async () => {
    const port: PostageExtensionPort = {
      async status() {
        return { usable: true, durationMs: null };
      },
      async extend() {},
      async topUp() {},
    };
    const withBoth = await extendExistingStorage(port, 'b', { size: 4, durationMs: 30 * 86400000, topUpAmount: 50 });
    expect(withBoth).toEqual({ batchId: 'b', extended: true, toppedUp: true });

    const justTopUp = await extendExistingStorage(port, 'b', { topUpAmount: 50 });
    expect(justTopUp).toEqual({ batchId: 'b', extended: false, toppedUp: true });
  });

  it('rejects extension when the batch is unusable', async () => {
    const port: PostageExtensionPort = {
      async status() {
        return { usable: false, durationMs: 0 };
      },
      async extend() {},
      async topUp() {},
    };
    await expect(extendExistingStorage(port, 'b', { topUpAmount: 5 })).rejects.toBeInstanceOf(StorageExtensionError);
  });
});