import { toNodeId } from '@hierarchidb/core-types';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLocationProgress } from '../../useLocationProgress';

const progressMock = vi.hoisted(() => ({
  progressState: {
    progress: null as null | {
      nodeId: ReturnType<typeof toNodeId>;
      stage: 'source';
      status: 'completed';
      timestamp: number;
      taskCounts: { total: number; completed: number; failed: number; skipped: number };
      percentage: number;
      message?: string;
    },
    status: null,
    error: null,
  },
}));

vi.mock('@hierarchidb/ui-build-sessions', () => ({
  useBuildSessionStateTreeBridge: () => ({ progressState: progressMock.progressState }),
}));

describe('useLocationProgress canonical mapping', () => {
  it('keeps the canonical stage separate from the completed lifecycle status', () => {
    const nodeId = toNodeId('location-node');
    progressMock.progressState.progress = {
      nodeId,
      stage: 'source',
      status: 'completed',
      timestamp: 1_000,
      taskCounts: { total: 2, completed: 2, failed: 0, skipped: 0 },
      percentage: 100,
    };

    const { result } = renderHook(() => useLocationProgress(nodeId));

    expect(result.current.progress).toMatchObject({
      stage: 'source',
      status: 'completed',
      total: 2,
      completed: 2,
      percentage: 100,
    });
  });
});
