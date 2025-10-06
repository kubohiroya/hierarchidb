import { describe, expect, it } from 'vitest';
import { createPeerStoreNormalizer } from '../normalizer.js';
import type { PeerDataBase } from '../types.js';

interface ExamplePeerData extends PeerDataBase {
  schemaVersion: 1;
  domain: {
    foo?: string;
    count?: number;
  };
}

const defaults = () => ({
  schemaVersion: 1 as const,
  domain: {
    foo: 'bar',
    count: 0,
  },
  metadata: {
    source: 'defaults',
  },
});

describe('createPeerStoreNormalizer', () => {

  it('returns default payload when input is missing', () => {
    const normalize = createPeerStoreNormalizer<ExamplePeerData>(defaults);
    const result = normalize();

    expect(result.schemaVersion).toBe(1);
    expect(result.domain).toEqual({ foo: 'bar', count: 0 });
    expect(result.metadata).toEqual({ source: 'defaults' });
  });

  it('merges input fields and metadata on top of defaults', () => {
    const normalize = createPeerStoreNormalizer<ExamplePeerData>(defaults);
    const result = normalize({
      domain: { count: 5 },
      metadata: { source: 'override', tags: ['a', 'b'] },
    });

    expect(result.domain).toEqual({ foo: 'bar', count: 5 });
    expect(result.metadata).toEqual({ source: 'override', tags: ['a', 'b'] });
  });

  it('retains default metadata keys when input metadata is partial', () => {
    const normalize = createPeerStoreNormalizer<ExamplePeerData>(defaults);
    const result = normalize({ metadata: { tags: ['x'] } });

    expect(result.metadata).toEqual({ source: 'defaults', tags: ['x'] });
  });
});
