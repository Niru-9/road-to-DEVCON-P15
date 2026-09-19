import { describe, it, expect } from 'vitest';
import { readThroughStableEntrypoint } from '../src/reader/reader.js';
import type { RootAccess, RootPointerRecord } from '../src/authority/root.js';
import type { ContentReaderPort } from '../src/reader/reader.js';
import { RootUnresolvableError } from '../src/errors.js';

const PUB = '0x' + 'a'.repeat(64);

describe('reader uses one stable entrypoint (P3-T1)', () => {
  it('resolves root -> publisher -> content; reader identifiers never change', async () => {
    const root: RootAccess = {
      async readRoot() {
        return { publisher: PUB, topic: 'content', nonce: 2 } satisfies RootPointerRecord;
      },
      async writeRoot() {
        return {};
      },
    };
    const content: ContentReaderPort = {
      async readContent(publisher: string, topic: string) {
        expect(publisher).toBe(PUB);
        expect(topic).toBe('content');
        return new TextEncoder().encode('archive-content');
      },
    };
    const result = await readThroughStableEntrypoint(root, content, { authorityOwner: '0xauthority', rootTopic: 'succession-pointer' });
    expect(result.pointer.publisher).toBe(PUB);
    expect(new TextDecoder().decode(result.content)).toBe('archive-content');
  });

  it('surfaces a typed error when the root feed is unavailable', async () => {
    const root: RootAccess = {
      async readRoot() {
        throw new Error('empty feed');
      },
      async writeRoot() {
        return {};
      },
    };
    const content: ContentReaderPort = { async readContent() { return new Uint8Array(); } };
    await expect(readThroughStableEntrypoint(root, content, { authorityOwner: '0xauth', rootTopic: 'pt' })).rejects.toBeInstanceOf(
      RootUnresolvableError,
    );
  });
});