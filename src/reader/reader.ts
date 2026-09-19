// Reader contract (P3-T1): stable entrypoint = authority root feed -> current
// publisher -> content. The reader's initial identifier NEVER changes.

import type { RootPointerRecord } from '../authority/root.js';
import type { RootAccess } from '../authority/root.js';
import { RootUnresolvableError } from '../errors.js';

export interface ContentReaderPort {
  /** Download content bytes from the publisher's content feed. */
  readContent(publisher: string, topic: string): Promise<Uint8Array>;
}

export interface ReaderInput {
  /** Stable authority owner + root topic captured at init; never updated. */
  authorityOwner: string;
  rootTopic: string;
}

export async function readThroughStableEntrypoint(
  root: RootAccess,
  content: ContentReaderPort,
  input: ReaderInput,
): Promise<{ pointer: RootPointerRecord; content: Uint8Array }> {
  let pointer: RootPointerRecord;
  try {
    pointer = await root.readRoot();
  } catch (err) {
    throw new RootUnresolvableError(
      `Could not resolve root feed (authority=${input.authorityOwner}, topic=${input.rootTopic}).`,
      { cause: err },
    );
  }
  const bytes = await content.readContent(pointer.publisher, pointer.topic);
  return { pointer, content: bytes };
}