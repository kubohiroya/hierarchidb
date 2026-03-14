import { describe, expect, it } from 'vitest';
import {
  resolveCompletionFailedStageLabel,
  resolveActiveRunningStageId,
} from '../../../components/build-progress/useBuildProgressPanelState/useBuildProgressPanelState.utils';

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
