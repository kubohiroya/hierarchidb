import { describe, expect, it, vi } from 'vitest';
import { buildStatsByOrigin } from './previewStageStats.js';

describe('previewStageStats', () => {
  it('aggregates stats by originKey', async () => {
    const getExtractedBuffer = vi.fn(async (id: string) => ({ data: new TextEncoder().encode(id).buffer }));
    const summarizeBufferStats = vi.fn(async () => ({ vertexCount: 1, polygonCount: 2 }));
    const accumulateStats = (a: any, b: any) => ({
      vertexCount: a.vertexCount + b.vertexCount,
      polygonCount: a.polygonCount + b.polygonCount,
    });

    const statsByOrigin = await buildStatsByOrigin({
      tasks: [
        { taskId: 't1', index: 0 },
        { taskId: 't2', index: 1 },
        { taskId: 't3', index: 2 },
      ],
      inputsByTaskId: new Map([
        ['t1', { originKey: 'o1' }],
        ['t2', { originKey: 'o1' }],
        ['t3', { originKey: 'o2' }],
      ]),
      buildBufferId: (i) => `buf-${i}`,
      getExtractedBuffer,
      summarizeBufferStats,
      accumulateStats,
    });

    expect(getExtractedBuffer).toHaveBeenCalledTimes(3);
    expect(statsByOrigin.get('o1')).toEqual({ vertexCount: 2, polygonCount: 4 });
    expect(statsByOrigin.get('o2')).toEqual({ vertexCount: 1, polygonCount: 2 });
  });

  it('skips tasks without originKey or missing buffer', async () => {
    const getExtractedBuffer = vi.fn(async (id: string) => (id === 'buf-1' ? null : ({ data: new ArrayBuffer(0) })));
    const summarizeBufferStats = vi.fn(async () => ({ vertexCount: 1, polygonCount: 1 }));
    const accumulateStats = (a: any, b: any) => ({
      vertexCount: a.vertexCount + b.vertexCount,
      polygonCount: a.polygonCount + b.polygonCount,
    });

    const statsByOrigin = await buildStatsByOrigin({
      tasks: [
        { taskId: 't1', index: 0 },
        { taskId: 't2', index: 1 },
        { taskId: 't3', index: 2 },
      ],
      inputsByTaskId: new Map([
        ['t1', { originKey: 'o1' }],
        ['t2', { originKey: 'o1' }],
        ['t3', undefined],
      ]),
      buildBufferId: (i) => `buf-${i}`,
      getExtractedBuffer,
      summarizeBufferStats,
      accumulateStats,
    });

    expect(statsByOrigin.get('o1')).toEqual({ vertexCount: 1, polygonCount: 1 });
    expect(statsByOrigin.get('o2')).toBeUndefined();
  });
});

