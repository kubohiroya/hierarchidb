import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteBuildLiveProgress } from '../../RouteBuildLiveProgress';
import { RouteBuildSummary } from '../../RouteBuildSummary';

const { mockUseRouteBuildProgress } = vi.hoisted(() => ({
  mockUseRouteBuildProgress: vi.fn(),
}));

beforeEach(() => {
  mockUseRouteBuildProgress.mockReset();
});

vi.mock('~/ui/hooks/useRouteBuildProgress', () => ({
  useRouteBuildProgress: mockUseRouteBuildProgress,
}));

vi.mock('@hierarchidb/ui-i18n', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? '',
  }),
}));

describe('RouteBuildLiveProgress', () => {
  it('renders progress, stage, and pause control', () => {
    mockUseRouteBuildProgress.mockReturnValue({
      snapshot: undefined,
      ready: true,
      progress: {
        stage: 'routing',
        payload: { total: 100, completed: 42, failed: 0, skipped: 0 },
      },
      status: { status: 'running' },
      isPaused: false,
      isMutating: false,
      mutationError: null,
      lastError: null,
      pause: vi.fn(),
      resume: vi.fn(),
    });

    render(<RouteBuildLiveProgress jobId="job-1" />);

    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('routing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
  });

  it('renders resume control and mutation errors while paused', () => {
    mockUseRouteBuildProgress.mockReturnValue({
      snapshot: undefined,
      ready: true,
      progress: {
        stage: 'routing',
        payload: { total: 100, completed: 55, failed: 0, skipped: 0 },
      },
      status: { status: 'paused' },
      isPaused: true,
      isMutating: false,
      mutationError: 'Network error',
      lastError: 'Network error',
      pause: vi.fn(),
      resume: vi.fn(),
    });

    render(<RouteBuildLiveProgress jobId="job-2" />);

    expect(screen.getByRole('button', { name: 'Resume' })).toBeEnabled();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });
});

describe('RouteBuildSummary', () => {
  it('renders summary metrics and the last error', async () => {
    mockUseRouteBuildProgress.mockReturnValue({
      snapshot: undefined,
      ready: true,
      progress: {
        payload: { completed: 4, total: 10, failed: 2, skipped: 0 },
      },
      status: { status: 'running' },
      isPaused: false,
      isMutating: false,
      mutationError: null,
      lastError: 'Worker error',
      pause: vi.fn(),
      resume: vi.fn(),
    });

    render(<RouteBuildSummary nodeId="job-3" />);

    await waitFor(() => {
      expect(screen.getByText(/Completed: 4 \/ Total: 10/)).toBeInTheDocument();
    });

    expect(screen.getByText('Results: 4')).toBeInTheDocument();
    expect(screen.getByText('Failed: 2')).toBeInTheDocument();
    expect(screen.getByText('Last error: Worker error')).toBeInTheDocument();
  });
});
