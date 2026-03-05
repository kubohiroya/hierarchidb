import { describe, expect, it } from 'vitest';
import {
  resolveCompletionFailedStageLabel,
  resolveActiveRunningStageId,
  shouldUpdateElapsedSnapshot,
} from '../../../components/build-progress/useBuildProgressPanelState/useBuildProgressPanelState.utils';

describe('shouldUpdateElapsedSnapshot', () => {
  it('returns true when there is no snapshot yet', () => {
    expect(shouldUpdateElapsedSnapshot({
      snapshot: null,
      totalElapsedMs: 0,
      buildStatus: 'idle',
    })).toBe(true);
  });

  it('returns false when elapsed decreases while running', () => {
    expect(shouldUpdateElapsedSnapshot({
      snapshot: { durationMs: 10_000, capturedAt: 1_000 },
      totalElapsedMs: 9_000,
      buildStatus: 'running',
    })).toBe(false);
  });

  it('returns true when reset sets elapsed to zero during running', () => {
    expect(shouldUpdateElapsedSnapshot({
      snapshot: { durationMs: 10_000, capturedAt: 1_000 },
      totalElapsedMs: 0,
      buildStatus: 'running',
    })).toBe(true);
  });

  it('returns true when build is not running', () => {
    expect(shouldUpdateElapsedSnapshot({
      snapshot: { durationMs: 10_000, capturedAt: 1_000 },
      totalElapsedMs: 8_000,
      buildStatus: 'paused',
    })).toBe(true);
  });
});

describe('resolveCompletionFailedStageLabel', () => {
  it('uses failed stage title when available', () => {
    expect(resolveCompletionFailedStageLabel({
      stages: [
        { id: 'source', title: 'Source', icon: null },
        { id: 'tileEmit', title: 'TileEmit', icon: null },
      ],
      failedStageId: 'tileEmit',
      fallbackStageLabel: 'Source',
    })).toBe('TileEmit');
  });

  it('falls back when failed stage is unavailable', () => {
    expect(resolveCompletionFailedStageLabel({
      stages: [{ id: 'source', title: 'Source', icon: null }],
      failedStageId: undefined,
      fallbackStageLabel: 'Source',
    })).toBe('Source');
  });
});

describe('resolveActiveRunningStageId', () => {
  const stages = [
    { id: 'source', title: 'Source', icon: null },
    { id: 'geometry', title: 'Geometry', icon: null },
    { id: 'tileEmit', title: 'TileEmit', icon: null },
  ];

  it('returns the most advanced running stage when overlap exists', () => {
    expect(resolveActiveRunningStageId({
      stages,
      stageTaskScan: {
        source: { hasRunning: false },
        geometry: { hasRunning: true },
        tileEmit: { hasRunning: true },
      },
    })).toBe('tileEmit');
  });

  it('returns null when no stage is running', () => {
    expect(resolveActiveRunningStageId({
      stages,
      stageTaskScan: {
        source: { hasRunning: false },
        geometry: { hasRunning: false },
        tileEmit: { hasRunning: false },
      },
    })).toBeNull();
  });

  it('prefers canonical tileEmit stage even when stage order is stale', () => {
    expect(resolveActiveRunningStageId({
      stages: [
        { id: 'source', title: 'Source', icon: null },
        { id: 'tileEmit', title: 'TileEmit', icon: null },
        { id: 'geometry', title: 'Geometry', icon: null },
      ],
      stageTaskScan: {
        source: { hasRunning: false },
        geometry: { hasRunning: true },
        tileEmit: { hasRunning: true },
      },
    })).toBe('tileEmit');
  });
});
