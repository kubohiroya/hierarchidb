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
      snapshot: { elapsedMs: 10_000, capturedAt: 1_000 },
      totalElapsedMs: 9_000,
      buildStatus: 'running',
    })).toBe(false);
  });

  it('returns true when reset sets elapsed to zero during running', () => {
    expect(shouldUpdateElapsedSnapshot({
      snapshot: { elapsedMs: 10_000, capturedAt: 1_000 },
      totalElapsedMs: 0,
      buildStatus: 'running',
    })).toBe(true);
  });

  it('returns true when build is not running', () => {
    expect(shouldUpdateElapsedSnapshot({
      snapshot: { elapsedMs: 10_000, capturedAt: 1_000 },
      totalElapsedMs: 8_000,
      buildStatus: 'paused',
    })).toBe(true);
  });
});

describe('resolveCompletionFailedStageLabel', () => {
  it('uses failed stage title when available', () => {
    expect(resolveCompletionFailedStageLabel({
      stages: [
        { id: 'fetch', title: 'Fetch', icon: null },
        { id: 'vt', title: 'VT', icon: null },
      ],
      failedStageId: 'vt',
      fallbackStageLabel: 'Fetch',
    })).toBe('VT');
  });

  it('falls back when failed stage is unavailable', () => {
    expect(resolveCompletionFailedStageLabel({
      stages: [{ id: 'fetch', title: 'Fetch', icon: null }],
      failedStageId: undefined,
      fallbackStageLabel: 'Fetch',
    })).toBe('Fetch');
  });
});

describe('resolveActiveRunningStageId', () => {
  const stages = [
    { id: 'fetch', title: 'Fetch', icon: null },
    { id: 'transform', title: 'Transform', icon: null },
    { id: 'vt', title: 'VT', icon: null },
  ];

  it('returns the most advanced running stage when overlap exists', () => {
    expect(resolveActiveRunningStageId({
      stages,
      stageTaskScan: {
        fetch: { hasRunning: false },
        transform: { hasRunning: true },
        vt: { hasRunning: true },
      },
    })).toBe('vt');
  });

  it('returns null when no stage is running', () => {
    expect(resolveActiveRunningStageId({
      stages,
      stageTaskScan: {
        fetch: { hasRunning: false },
        transform: { hasRunning: false },
        vt: { hasRunning: false },
      },
    })).toBeNull();
  });

  it('prefers canonical vt stage even when stage order is stale', () => {
    expect(resolveActiveRunningStageId({
      stages: [
        { id: 'fetch', title: 'Fetch', icon: null },
        { id: 'vt', title: 'VT', icon: null },
        { id: 'transform', title: 'Transform', icon: null },
      ],
      stageTaskScan: {
        fetch: { hasRunning: false },
        transform: { hasRunning: true },
        vt: { hasRunning: true },
      },
    })).toBe('vt');
  });
});
