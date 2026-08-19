import { describe, expect, it, vi } from 'vitest';
import {
  createYamlCanonicalPostimageDigest,
  YamlCanonicalPostimageDigestError,
} from '../../src/migration/createYamlCanonicalPostimageDigest.js';

const VALID_DIGEST = '0123456789abcdef'.repeat(4);

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('createYamlCanonicalPostimageDigest', () => {
  it('encodes filename, subtype, schemaId, and empty content with 8-byte big-endian lengths', async () => {
    let receivedBytes: Uint8Array | undefined;
    const result = await createYamlCanonicalPostimageDigest(
      'git.yml',
      { subtype: 'git', schemaId: 'ide-gsm/git', content: '' },
      async (bytes) => {
        receivedBytes = bytes;
        return VALID_DIGEST;
      }
    );

    expect(result).toBe(VALID_DIGEST);
    expect(receivedBytes).toBeDefined();
    if (receivedBytes === undefined) return;
    expect(bytesToHex(receivedBytes)).toBe(
      [
        '0000000000000007',
        '6769742e796d6c',
        '0000000000000003',
        '676974',
        '000000000000000b',
        '6964652d67736d2f676974',
        '0000000000000000',
      ].join('')
    );
  });

  it('uses UTF-8 byte lengths rather than JavaScript string lengths', async () => {
    let receivedBytes: Uint8Array | undefined;
    await createYamlCanonicalPostimageDigest(
      '設定.yml',
      { subtype: 'scenario', schemaId: 'ide-gsm/scenario', content: 'name: 東京\n' },
      async (bytes) => {
        receivedBytes = bytes;
        return VALID_DIGEST;
      }
    );

    expect(receivedBytes).toBeDefined();
    if (receivedBytes === undefined) return;
    const view = new DataView(
      receivedBytes.buffer,
      receivedBytes.byteOffset,
      receivedBytes.byteLength
    );
    expect(view.getBigUint64(0, false)).toBe(10n);
  });

  it('separates otherwise ambiguous field boundaries', async () => {
    const captured: Uint8Array[] = [];
    const digest = async (bytes: Uint8Array): Promise<string> => {
      captured.push(bytes.slice());
      return VALID_DIGEST;
    };

    await createYamlCanonicalPostimageDigest(
      'scenario.yml',
      { subtype: 'scenario', schemaId: 'ab', content: 'c' },
      digest
    );
    await createYamlCanonicalPostimageDigest(
      'scenario.yml',
      { subtype: 'scenario', schemaId: 'a', content: 'bc' },
      digest
    );

    expect(captured).toHaveLength(2);
    expect(captured[0]).not.toEqual(captured[1]);
  });

  it('converts a digest port rejection into a typed failure without its message', async () => {
    const operation = createYamlCanonicalPostimageDigest(
      'git.yml',
      { subtype: 'git', schemaId: 'ide-gsm/git', content: 'url: secret\n' },
      async () => {
        throw new Error('credential-value-must-not-leak');
      }
    );

    await expect(operation).rejects.toMatchObject({ code: 'DIGEST_PORT_FAILED' });
    await expect(operation).rejects.not.toThrow('credential-value-must-not-leak');
  });

  it.each(['A'.repeat(64), '0'.repeat(63), '0'.repeat(65), 'not-a-digest'])(
    'rejects invalid lowercase SHA-256 output %s',
    async (invalidDigest) => {
      const operation = createYamlCanonicalPostimageDigest(
        'git.yml',
        { subtype: 'git', schemaId: 'ide-gsm/git', content: 'url: value\n' },
        vi.fn(async () => invalidDigest)
      );

      await expect(operation).rejects.toEqual(
        new YamlCanonicalPostimageDigestError('INVALID_DIGEST_OUTPUT')
      );
    }
  );
});
