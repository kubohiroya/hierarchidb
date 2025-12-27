import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RouteBatchLiveProgress } from '../RouteBatchLiveProgress.js';
import { RouteBatchSummary } from '../RouteBatchSummary.js';

const mockUseRouteBatchProgress = vi.fn();

vi.mock('../../hooks/useRouteBatchProgress.js', () => ({
  useRouteBatchProgress: mockUseRouteBatchProgress,
}));

beforeEach(() => {
  mockUseRouteBatchProgress.mockReset();
});

describe('RouteBatchLiveProgress', () => {
  it('exposes progress indicators via data-testid attributes', () => {
    mockUseRouteBatchProgress.mockReturnValue({
      snapshot: undefined,
      ready: true,
      progress: { percentage: 42, stage: 'routing', currentTask: 'routing' },
      status: { status: 'running' },
      isPaused: false,
      isMutating: false,
      mutationError: null,
      lastError: null,
      pause: vi.fn(),
      resume: vi.fn(),
    });

    render(<RouteBatchLiveProgress jobId="job-1" enableControls={true} />);

    const root = screen.getByTestId('route-live-progress');
    expect(root).toHaveAttribute('data-progress-state', 'running');
    expect(screen.getByTestId('route-live-progress-percentage').textContent).toBe('42%');
    expect(screen.getByTestId('route-live-progress-stage').textContent).toBe('ルート生成');
    expect(screen.getByTestId('route-live-progress-toggle')).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks paused state and surfaces mutation errors', () => {
    mockUseRouteBatchProgress.mockReturnValue({
      snapshot: undefined,
      ready: true,
      progress: { percentage: 55, stage: 'routing', currentTask: 'routing' },
      status: { status: 'paused' },
      isPaused: true,
      isMutating: false,
      mutationError: 'Network error',
      lastError: 'Network error',
      pause: vi.fn(),
      resume: vi.fn(),
    });

    render(<RouteBatchLiveProgress jobId="job-2" enableControls={true} />);

    expect(screen.getByTestId('route-live-progress')).toHaveAttribute('data-progress-state', 'paused');
    expect(screen.getByTestId('route-live-progress-toggle')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('route-live-progress-error')).toHaveTextContent('Network error');
  });
});

describe('RouteBatchSummary', () => {
  it('renders summary metrics with stable data-testid selectors', async () => {
    mockUseRouteBatchProgress.mockReturnValue({
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

    render(<RouteBatchSummary sessionId="job-3" />);

    await waitFor(() => {
      expect(screen.getByTestId('route-summary-completed').textContent).toContain('完了: 4');
    });

    expect(screen.getByTestId('route-summary-results').textContent).toContain('結果: 4');
    expect(screen.getByTestId('route-summary-failed').textContent).toBe('失敗: 2');
    expect(screen.getByTestId('route-summary-last-error')).toHaveAttribute('data-error-state', 'error');
    expect(screen.getByTestId('route-summary-last-error').textContent).toContain('最新のエラー: Worker error');
  });
});
