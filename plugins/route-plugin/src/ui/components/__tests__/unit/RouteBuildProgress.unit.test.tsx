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

describe('RouteBuildLiveProgress', () => {
  it('exposes progress indicators via data-testid attributes', () => {
    mockUseRouteBuildProgress.mockReturnValue({
      snapshot: null,
      ready: true,
      progress: {
        percentage: 42,
        stage: 'geometry',
        status: 'running',
        taskCounts: { total: 10, completed: 4, failed: 0, skipped: 0 },
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

    const root = screen.getByTestId('route-live-progress');
    expect(root).toHaveAttribute('data-progress-atoms', 'running');
    expect(screen.getByTestId('route-live-progress-percentage').textContent).toBe('42%');
    expect(screen.getByTestId('route-live-progress-stage').textContent).toBe('geometry');
    expect(screen.getByTestId('route-live-progress-toggle')).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('marks paused atoms and surfaces mutation errors', () => {
    mockUseRouteBuildProgress.mockReturnValue({
      snapshot: null,
      ready: true,
      progress: {
        percentage: 55,
        stage: 'geometry',
        status: 'paused',
        taskCounts: { total: 10, completed: 5, failed: 0, skipped: 0 },
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

    expect(screen.getByTestId('route-live-progress')).toHaveAttribute(
      'data-progress-atoms',
      'paused'
    );
    expect(screen.getByTestId('route-live-progress-toggle')).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTestId('route-live-progress-error')).toHaveTextContent('Network error');
  });
});

describe('RouteBuildSummary', () => {
  it('renders summary metrics with stable data-testid selectors', async () => {
    mockUseRouteBuildProgress.mockReturnValue({
      snapshot: null,
      ready: true,
      progress: {
        percentage: 40,
        stage: 'source',
        status: 'running',
        taskCounts: { completed: 4, total: 10, failed: 2, skipped: 0 },
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
      expect(screen.getByTestId('route-summary-completed')).toHaveTextContent(
        'Completed: 4 / Total: 10'
      );
    });

    expect(screen.getByTestId('route-summary-results')).toHaveTextContent('Results: 4');
    expect(screen.getByTestId('route-summary-failed')).toHaveTextContent('Failed: 2');
    expect(screen.getByTestId('route-summary-last-error')).toHaveAttribute(
      'data-error-atoms',
      'error'
    );
    expect(screen.getByTestId('route-summary-last-error')).toHaveTextContent(
      'Last error: Worker error'
    );
  });
});
