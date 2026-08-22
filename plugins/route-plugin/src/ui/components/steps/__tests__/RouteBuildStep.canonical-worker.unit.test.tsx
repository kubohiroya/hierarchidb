// @vitest-environment jsdom

import type { BuildStatus } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import { ROUTE_MODES, type RouteEntity } from '@hierarchidb/route-api';
import type { BuildSessionProgressPanelProps } from '@hierarchidb/ui-build-progress';
import type { BuildSessionLifecycleSnapshot } from '@hierarchidb/ui-build-sessions';
import type { CrashInsight } from '@hierarchidb/ui-monitoring';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ROUTE_BUILD_CONFIG } from '~/common/config/buildConfig.js';
import { RouteBuildStep } from '../RouteBuildStep/RouteBuildStep.js';

type ProgressResult = {
  progress: null;
  status: BuildSessionLifecycleSnapshot | null;
  lastError: string | null;
  subscriptionReady: boolean;
};

const createLifecycleStatus = (status: BuildStatus): BuildSessionLifecycleSnapshot => ({
  nodeId: 'route-node' as NodeId,
  status,
  startedAt: status === 'queued' || status === 'idle' ? undefined : 1_000,
  completedAt: status === 'completed' || status === 'failed' ? 2_000 : undefined,
});

const validDraft = {
  buildConfig: DEFAULT_ROUTE_BUILD_CONFIG,
  routeBuildInput: { kind: 'direct-route' },
  routeMode: ROUTE_MODES.ROAD,
  transportSelection: 'road',
  startLocationId: 'location-start' as NodeId,
  endLocationId: 'location-end' as NodeId,
  lineGeometry: [
    [0, 0],
    [1, 1],
  ],
} as Partial<RouteEntity>;

const mocks = vi.hoisted(() => ({
  progress: {
    progress: null,
    status: null,
    lastError: null,
    subscriptionReady: false,
  } as ProgressResult,
  pendingCommand: null as 'start' | 'pause' | 'cancel' | null,
  startBuildSession: vi.fn(async () => true),
  pauseBuildSession: vi.fn(async () => true),
  cancelQueuedBuildSession: vi.fn(async () => true),
  crashInsight: null as CrashInsight | null,
  panelProps: null as BuildSessionProgressPanelProps | null,
}));

vi.mock('@hierarchidb/ui-build-sessions', async () => {
  const actual = await vi.importActual<typeof import('@hierarchidb/ui-build-sessions')>(
    '@hierarchidb/ui-build-sessions'
  );
  return {
    ...actual,
    useCanonicalBuildSessionControls: () => ({
      canStartBuildSession: mocks.progress.subscriptionReady && mocks.pendingCommand === null,
      pendingCommand: mocks.pendingCommand,
      mutationError: null,
      pauseBuildSession: mocks.pauseBuildSession,
      startBuildSession: mocks.startBuildSession,
      cancelQueuedBuildSession: mocks.cancelQueuedBuildSession,
    }),
  };
});

vi.mock('@hierarchidb/ui-build-progress', async () => {
  const actual = await vi.importActual<typeof import('@hierarchidb/ui-build-progress')>(
    '@hierarchidb/ui-build-progress'
  );
  return {
    ...actual,
    BuildSessionProgressPanel: (props: BuildSessionProgressPanelProps) => {
      mocks.panelProps = props;
      return (
        <div>
          <button type="button" disabled={!props.onResume} onClick={props.onResume}>
            start
          </button>
          <button type="button" disabled={!props.onPause} onClick={props.onPause}>
            pause
          </button>
          <button type="button" disabled={!props.onCancel} onClick={props.onCancel}>
            cancel
          </button>
        </div>
      );
    },
  };
});

vi.mock('@hierarchidb/ui-i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? '',
  }),
}));

vi.mock('~/ui/hooks/useRouteBuildCrashInsight', () => ({
  useRouteBuildCrashInsight: () => mocks.crashInsight,
}));

vi.mock('~/ui/hooks/useRouteBuildProgress', () => ({
  useRouteBuildProgress: () => mocks.progress,
}));

describe('RouteBuildStep canonical Worker controls', () => {
  beforeEach(() => {
    mocks.progress = {
      progress: null,
      status: null,
      lastError: null,
      subscriptionReady: false,
    };
    mocks.pendingCommand = null;
    mocks.startBuildSession.mockClear();
    mocks.pauseBuildSession.mockClear();
    mocks.cancelQueuedBuildSession.mockClear();
    mocks.crashInsight = null;
    mocks.panelProps = null;
  });

  it('enables the canonical start command only after the Worker subscription is ready', async () => {
    const { rerender } = render(
      <RouteBuildStep draft={validDraft} onUpdate={vi.fn()} nodeId="route-node" mode="edit" />
    );

    expect(screen.getByRole('button', { name: 'start' })).toBeDisabled();
    expect(mocks.startBuildSession).not.toHaveBeenCalled();

    mocks.progress = { ...mocks.progress, subscriptionReady: true };
    rerender(
      <RouteBuildStep draft={validDraft} onUpdate={vi.fn()} nodeId="route-node" mode="edit" />
    );
    const startButton = screen.getByRole('button', { name: 'start' });
    expect(startButton).toBeEnabled();
    await act(async () => {
      fireEvent.click(startButton);
    });
    expect(mocks.startBuildSession).toHaveBeenCalledOnce();
  });

  it('routes queued cancellation to the canonical Worker command', async () => {
    mocks.progress = {
      ...mocks.progress,
      status: createLifecycleStatus('queued'),
      subscriptionReady: true,
    };
    render(
      <RouteBuildStep draft={validDraft} onUpdate={vi.fn()} nodeId="route-node" mode="edit" />
    );

    expect(screen.getByRole('button', { name: 'start' })).toBeDisabled();
    const cancelButton = screen.getByRole('button', { name: 'cancel' });
    expect(cancelButton).toBeEnabled();
    await act(async () => {
      fireEvent.click(cancelButton);
    });
    expect(mocks.cancelQueuedBuildSession).toHaveBeenCalledWith('user-cancel');
  });

  it('routes pause and resume through canonical Worker commands and opens the suspend dialog', async () => {
    mocks.progress = {
      ...mocks.progress,
      status: createLifecycleStatus('running'),
      subscriptionReady: true,
    };
    const { rerender } = render(
      <RouteBuildStep draft={validDraft} onUpdate={vi.fn()} nodeId="route-node" mode="edit" />
    );

    const pauseButton = screen.getByRole('button', { name: 'pause' });
    expect(pauseButton).toBeEnabled();
    await act(async () => {
      fireEvent.click(pauseButton);
    });
    expect(mocks.pauseBuildSession).toHaveBeenCalledWith('user-pause');

    mocks.progress = {
      ...mocks.progress,
      status: createLifecycleStatus('paused'),
    };
    rerender(
      <RouteBuildStep draft={validDraft} onUpdate={vi.fn()} nodeId="route-node" mode="edit" />
    );

    await waitFor(() => expect(mocks.panelProps?.suspendDialog?.open).toBe(true));
    const resumeButton = screen.getByRole('button', { name: 'start' });
    expect(resumeButton).toBeEnabled();
    await act(async () => {
      fireEvent.click(resumeButton);
    });
    expect(mocks.startBuildSession).toHaveBeenCalledOnce();
  });

  it('opens the shared completion dialog and persists the canonical completion timestamp', async () => {
    const onUpdate = vi.fn();
    mocks.progress = {
      ...mocks.progress,
      status: createLifecycleStatus('running'),
      subscriptionReady: true,
    };
    const { rerender } = render(
      <RouteBuildStep draft={validDraft} onUpdate={onUpdate} nodeId="route-node" mode="edit" />
    );

    mocks.progress = {
      ...mocks.progress,
      status: createLifecycleStatus('completed'),
    };
    rerender(
      <RouteBuildStep draft={validDraft} onUpdate={onUpdate} nodeId="route-node" mode="edit" />
    );

    await waitFor(() => expect(mocks.panelProps?.completionDialog?.open).toBe(true));
    expect(onUpdate).toHaveBeenLastCalledWith({
      processingStatus: 'completed',
      processedAt: 2_000,
      buildFinishedAt: 2_000,
      processingError: undefined,
    });
  });

  it('opens the shared crash dialog when canonical monitoring reports an interruption', async () => {
    mocks.progress = { ...mocks.progress, subscriptionReady: true };
    mocks.crashInsight = {
      stage: 'geometry',
      peakRatio: 0.9,
      memoryPressure: true,
      buildStartedAt: 1_000,
    };

    render(
      <RouteBuildStep draft={validDraft} onUpdate={vi.fn()} nodeId="route-node" mode="edit" />
    );

    await waitFor(() => expect(mocks.panelProps?.crashDialog?.open).toBe(true));
  });
});
