// Storage continuity (P3-T3): extend/top-up the SAME existing batch id — never a
// fresh rebuy. The configured BATCH_ID from .env or init output is reused, and the
// orchestrator asserts the id passed to the extension primitive matches it.

import { StorageExtensionError } from '../errors.js';

export interface PostageExtensionPort {
  /** Node-reported usable flag + remaining lifetime for a batch id. */
  status(batchId: string): Promise<{ usable: boolean; durationMs: number | null }>;
  /** Extend an EXISTING batch (same id must be reused). */
  extend(batchId: string, size: number, durationMs: number): Promise<unknown>;
  /** Top up an EXISTING batch (adds duration). */
  topUp(batchId: string, amount: number): Promise<unknown>;
}

export interface ExtensionResult {
  batchId: string;
  extended: boolean;
  toppedUp: boolean;
}

export async function extendExistingStorage(
  port: PostageExtensionPort,
  configBatchId: string,
  opts: { size?: number; durationMs?: number; topUpAmount?: number },
): Promise<ExtensionResult> {
  const result: ExtensionResult = { batchId: configBatchId, extended: false, toppedUp: false };
  try {
    const current = await port.status(configBatchId);
    if (!current.usable) {
      throw new StorageExtensionError(`Batch ${configBatchId} is not usable for extension.`);
    }
    if (opts.size !== undefined && opts.durationMs !== undefined) {
      await port.extend(configBatchId, opts.size, opts.durationMs);
      result.extended = true;
    } else if (opts.size !== undefined) {
      await port.extend(configBatchId, opts.size, 0);
      result.extended = true;
    }
    if (opts.topUpAmount !== undefined) {
      await port.topUp(configBatchId, opts.topUpAmount);
      result.toppedUp = true;
    }
    return result;
  } catch (err) {
    if (err instanceof StorageExtensionError) throw err;
    throw new StorageExtensionError(`Failed to extend storage for batch ${configBatchId}.`, { cause: err });
  }
}