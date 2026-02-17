import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RouteBuildLiveProgress } from '../RouteBuildLiveProgress.js';
import { RouteBuildSummary } from '../RouteBuildSummary.js';

const mockUseRouteBuildProgress = vi.fn();

beforeEach(() => {
  mockUseRouteBuildProgress.mockReset();
});

vi.mock('../../hooks/useRouteBuildProgress.js', () => ({
  useRouteBuildProgress: mockUseRouteBuildProgress,
}));

describe('RouteBuildLiveProgress', () => {
  it('exposes progress indicators via data-testid attributes', () => {
    mockUseRouteBuildProgress.mockReturnValue({
      snapshot: undefined,
      ready: true,
      progress: { percentage: 42, stage: 'routing' },
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
    expect(screen.getByTestId('route-live-progress-stage').textContent).toBe('ルート生成');
    expect(screen.getByTestId('route-live-progress-toggle')).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks paused atoms and surfaces mutation errors', () => {
    mockUseRouteBuildProgress.mockReturnValue({
      snapshot: undefined,
      ready: true,
      progress: { percentage: 55, stage: 'routing' },
      status: { status: 'paused' },
      isPaused: true,
      isMutating: false,
      mutationError: 'Network error',
      lastError: 'Network error',
      pause: vi.fn(),
      resume: vi.fn(),
    });

    render(<RouteBuildLiveProgress jobId="job-2" />);

    expect(screen.getByTestId('route-live-progress')).toHaveAttribute('data-progress-atoms', 'paused');
    expect(screen.getByTestId('route-live-progress-toggle')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('route-live-progress-error')).toHaveTextContent('Network error');
  });
});

describe('RouteBuildSummary', () => {
  it('renders summary metrics with stable data-testid selectors', async () => {
    mockUseRouteBuildProgress.mockReturnValue({
      snapshot: undefined,
      ready: true,
      progress: { completed: 4, total: 10, failed: 2, percentage: 40 },
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
      expect(screen.getByTestId('route-summary-completed').textContent).toContain('完了: 4');
    });

    expect(screen.getByTestId('route-summary-results').textContent).toContain('結果: 4');
    expect(screen.getByTestId('route-summary-failed').textContent).toBe('失敗: 2');
    expect(screen.getByTestId('route-summary-last-error')).toHaveAttribute('data-error-atoms', 'error');
    expect(screen.getByTestId('route-summary-last-error').textContent).toContain('最新のエラー: Worker error');
  });
});
