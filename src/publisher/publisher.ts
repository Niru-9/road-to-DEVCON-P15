// Publisher: the CURRENT publisher signs the content feed. It must import nothing
// from identity/authority internals that would collapse the role separation.

import type { RootPointerRecord } from '../authority/root.js';

export interface ContentFeedPort {
  /** Write content bytes/ref to the publisher feed under its own signer. */
  publishContent(reference: string): Promise<unknown>;
  /** Public owner of the publisher's content feed. */
  owner(): string;
}

export async function publishUnderPublisher(
  currentPointer: RootPointerRecord,
  port: ContentFeedPort,
  contentReference: string,
): Promise<unknown> {
  if (port.owner() !== currentPointer.publisher) {
    throw new Error(`Publish key (${port.owner()}) does not match the current steward (${currentPointer.publisher}).`);
  }
  return port.publishContent(contentReference);
}