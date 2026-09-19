// Root-feed indirection. The reader starts from (authority owner, root topic)
// forever; the root feed's payload maps to the CURRENT publisher. Authority (root
// signer) and publisher (content signer) are distinct roles (P3-T6).

export interface RootPointerRecord {
  /** Current publisher public owner address (0x hex). */
  publisher: string;
  /** Topic of the publisher's content feed. */
  topic: string;
  /** Monotonic guard against replaying an older pointer. */
  nonce: number;
}

export interface RootAccess {
  /** Resolve the root feed to the current pointer record. Throws when empty. */
  readRoot(): Promise<RootPointerRecord>;
  /** Write a new pointer record to the root feed (signed by the authority). */
  writeRoot(record: RootPointerRecord): Promise<unknown>;
}

/**
 * Stable indirection: resolve root -> current publisher identity.
 * The reader's initial identifier (authority+root topic) never changes, so a
 * publisher rotation is invisible to readers (P3-T1).
 */
export async function resolveCurrentPublisher(access: RootAccess): Promise<RootPointerRecord> {
  return access.readRoot();
}