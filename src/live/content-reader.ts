// Live ContentReaderPort adapter: independent reader. Resolves the publisher's
// content feed to a content-addressed reference, then downloads the archive bytes.

import { Bee, Topic } from '@ethersphere/bee-js';
import type { ContentReaderPort } from '../reader/reader.js';
import { downloadBytes, withRetry } from './bee.js';

export function createContentReader(beeUrl: string): ContentReaderPort {
  const bee = new Bee(beeUrl);

  return {
    async readContent(publisher: string, topic: string): Promise<Uint8Array> {
      const contentTopicHash = Topic.fromString(topic);
      const reader = bee.feed.makeReader(contentTopicHash, publisher);
      const update = await withRetry(() => reader.downloadReference(), 8, 300, 'read content feed');
      return downloadBytes(bee, update.reference.toHex());
    },
  };
}