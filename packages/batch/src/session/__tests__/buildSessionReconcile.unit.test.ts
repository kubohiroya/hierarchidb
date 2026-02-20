import { describe, expect, it } from 'vitest';
import { reconcileByMetadata } from '~/session/buildSessionReconcile';

describe('reconcileByMetadata', () => {
  it('creates when artifact is missing', () => {
    const result = reconcileByMetadata(
      [{ key: 'A', meta: 'm1', updatedAt: 10 }],
      [],
    );
    expect(result.create).toEqual(['A']);
    expect(result.update).toEqual([]);
    expect(result.remove).toEqual([]);
  });

  it('updates when metadata differs', () => {
    const result = reconcileByMetadata(
      [{ key: 'A', meta: 'm2' }],
      [{ key: 'A', meta: 'm1' }],
    );
    expect(result.create).toEqual([]);
    expect(result.update).toEqual(['A']);
    expect(result.remove).toEqual([]);
  });

  it('uses timestamps when metadata is missing', () => {
    const result = reconcileByMetadata(
      [{ key: 'A', updatedAt: 200 }],
      [{ key: 'A', updatedAt: 100 }],
    );
    expect(result.create).toEqual([]);
    expect(result.update).toEqual(['A']);
    expect(result.remove).toEqual([]);
  });

  it('keeps when metadata matches and timestamps are not newer', () => {
    const result = reconcileByMetadata(
      [{ key: 'A', meta: 'm1', updatedAt: 200 }],
      [{ key: 'A', meta: 'm1', updatedAt: 100 }],
    );
    expect(result.create).toEqual([]);
    expect(result.update).toEqual([]);
    expect(result.remove).toEqual([]);
  });

  it('removes artifacts without sources', () => {
    const result = reconcileByMetadata(
      [],
      [{ key: 'A', meta: 'm1' }],
    );
    expect(result.create).toEqual([]);
    expect(result.update).toEqual([]);
    expect(result.remove).toEqual(['A']);
  });
});
