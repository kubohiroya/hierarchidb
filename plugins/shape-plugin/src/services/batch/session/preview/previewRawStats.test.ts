import { describe, expect, it, vi } from 'vitest';
import { buildRawStatsByOrigin } from './previewRawStats.js';

describe('previewRawStats', () => {
  it('aggregates stats by originKey', async () => {
    const getRawBuffer = vi.fn(async (id: string) => ({ data: new TextEncoder().encode(id).buffer }));
    const summarizeBufferStats = vi.fn(async () => ({ vertexCount: 1, polygonCount: 2 }));
    const accumulateStats = (a: any, b: any) => ({
      vertexCount: a.vertexCount + b.vertexCount,
      polygonCount: a.polygonCount + b.polygonCount,
    });

    const res = await buildRawStatsByOrigin({
      entries: [
        { originKey: 'o1', inputBufferId: 'b1' },
        { originKey: 'o1', inputBufferId: 'b2' },
        { originKey: 'o2', inputBufferId: 'b3' },
      ],
      getRawBuffer,
      summarizeBufferStats,
      accumulateStats,
    });

    expect(getRawBuffer).toHaveBeenCalledTimes(3);
    expect(res.get('o1')).toEqual({ vertexCount: 2, polygonCount: 4 });
    expect(res.get('o2')).toEqual({ vertexCount: 1, polygonCount: 2 });
  });

  it('skips missing raw buffers', async () => {
    const getRawBuffer = vi.fn(async (id: string) => (id === 'b2' ? null : ({ data: new ArrayBuffer(0) })));
    const summarizeBufferStats = vi.fn(async () => ({ vertexCount: 1, polygonCount: 1 }));
    const accumulateStats = (a: any, b: any) => ({
      vertexCount: a.vertexCount + b.vertexCount,
      polygonCount: a.polygonCount + b.polygonCount,
    });

    const res = await buildRawStatsByOrigin({
      entries: [
        { originKey: 'o1', inputBufferId: 'b1' },
        { originKey: 'o1', inputBufferId: 'b2' },
      ],
      getRawBuffer,
      summarizeBufferStats,
      accumulateStats,
    });

    expect(res.get('o1')).toEqual({ vertexCount: 1, polygonCount: 1 });
  });
});

