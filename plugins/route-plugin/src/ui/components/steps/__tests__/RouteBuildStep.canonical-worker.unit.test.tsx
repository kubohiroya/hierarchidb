// @vitest-environment jsdom

import type { NodeId } from '@hierarchidb/core-types';
import { ROUTE_MODES, type RouteEntity } from '@hierarchidb/route-api';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ROUTE_BUILD_CONFIG } from '~/common/config/buildConfig.js';
import { RouteBuildStep } from '../RouteBuildStep.js';

type ProgressResult = {
  progress: null;
  status: null;
  lastError: null;
  subscriptionReady: boolean;
};

type ProgressPanelProps = {
  onResume?: () => void;
};

const mocks = vi.hoisted(() => ({
  progress: {
    progress: null,
    status: null,
    lastError: null,
    subscriptionReady: false,
  } as ProgressResult,
  startBuildSession: vi.fn(async () => true),
  pauseBuildSession: vi.fn(async () => true),
  panelProps: null as ProgressPanelProps | null,
}));

vi.mock('@hierarchidb/ui-build-sessions', () => ({
  useCanonicalBuildSessionControls: () => ({
    canStartBuildSession: mocks.progress.subscriptionReady,
    pendingCommand: null,
    mutationError: null,
    pauseBuildSession: mocks.pauseBuildSession,
    startBuildSession: mocks.startBuildSession,
  }),
}));

vi.mock('@hierarchidb/ui-i18n', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock('~/ui/hooks/useRouteBuildCrashInsight', () => ({
  useRouteBuildCrashInsight: () => null,
}));

vi.mock('~/ui/hooks/useRouteBuildProgress', () => ({
  useRouteBuildProgress: () => mocks.progress,
}));

vi.mock('../useRouteBuildProgressPanelViewModel.js', () => ({
  useRouteBuildProgressPanelViewModel: (input: ProgressPanelProps) => input,
}));

vi.mock('../RouteBuildProgressPanel.js', () => ({
  RouteBuildProgressPanel: (props: ProgressPanelProps) => {
    mocks.panelProps = props;
    return (
      <button type="button" disabled={!props.onResume} onClick={props.onResume}>
        start
      </button>
    );
  },
}));

describe('RouteBuildStep canonical Worker launch', () => {
  beforeEach(() => {
    mocks.progress = {
      progress: null,
      status: null,
      lastError: null,
      subscriptionReady: false,
    };
    mocks.startBuildSession.mockClear();
    mocks.pauseBuildSession.mockClear();
    mocks.panelProps = null;
  });

  it('enables the canonical start command only after the Worker subscription is ready', async () => {
    const draft: Partial<RouteEntity> = {
      buildConfig: DEFAULT_ROUTE_BUILD_CONFIG,
      routeMode: ROUTE_MODES.ROAD,
      transportSelection: 'road',
      startLocationId: 'location-start' as NodeId,
      endLocationId: 'location-end' as NodeId,
      lineGeometry: [
        [0, 0],
        [1, 1],
      ],
    };
    const { rerender } = render(
      <RouteBuildStep draft={draft} onUpdate={vi.fn()} nodeId="route-node" mode="edit" />
    );

    expect(screen.getByRole('button', { name: 'start' })).toBeDisabled();
    expect(mocks.startBuildSession).not.toHaveBeenCalled();

    mocks.progress = { ...mocks.progress, subscriptionReady: true };
    rerender(<RouteBuildStep draft={draft} onUpdate={vi.fn()} nodeId="route-node" mode="edit" />);
    const startButton = screen.getByRole('button', { name: 'start' });
    expect(startButton).toBeEnabled();
    await act(async () => {
      fireEvent.click(startButton);
    });
    expect(mocks.startBuildSession).toHaveBeenCalledOnce();
  });
});
