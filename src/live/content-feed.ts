// Live ContentFeedPort adapter: the publisher's content feed is owned by the
// publisher's Ethereum address and holds a content-addressed reference to the
// actual archive bytes. owner() MUST equal the publisher string stored in the
// root pointer record so publishUnderPublisher's exact-match guard is truthful.

import { Bee, PrivateKey, Topic } from '@ethersphere/bee-js';
import type { ContentFeedPort } from '../publisher/publisher.js';
import { delay, withRetry } from './bee.js';
import { feedOwnerOf } from './identity.js';

export interface LiveContentFeedOptions {
  beeUrl: string;
  batchId: string;
  signer: PrivateKey;
  topic: string;
}

export function createContentFeedPort(opts: LiveContentFeedOptions): ContentFeedPort {
  const { beeUrl, batchId, signer, topic } = opts;
  const contentTopicHash = Topic.fromString(topic);
  const owner = feedOwnerOf(signer);
  const bee = new Bee(beeUrl);

  return {
    owner(): string {
      return owner;
    },

    async publishContent(reference: string): Promise<{ reference: string; feedIndex: string }> {
      const writer = bee.feed.makeWriter(contentTopicHash, signer);
      await writer.uploadReference(batchId, reference, { deferred: true });
      await delay(250);
      const reader = bee.feed.makeReader(contentTopicHash, owner);
      const feedIndex = await withRetry(
        async () => (await reader.downloadReference()).feedIndex.toBigInt().toString(),
        12,
        300,
        'read content feed index',
      );
      return { reference, feedIndex };
    },
  };
}