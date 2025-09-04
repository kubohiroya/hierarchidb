import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryUsageChart } from './MemoryUsageChart';

// Mock hook to control data and interactions
vi.mock('./hooks/useMemoryData', () => {
  return {
    useMemoryData: vi.fn(),
  };
});

// Mock CanvasRenderer to avoid real canvas operations
vi.mock('./services/CanvasRenderer', () => {
  return {
    CanvasRenderer: vi.fn().mockImplementation(() => ({
      addDataPoint: vi.fn(),
      render: vi.fn(),
      clearData: vi.fn(),
      dispose: vi.fn(),
    })),
  };
});

import { useMemoryData } from './hooks/useMemoryData';
const useMemoryDataMock = useMemoryData as unknown as vi.Mock;

const renderWithTheme = (ui: React.ReactElement) => {
  const theme = createTheme();
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

describe('MemoryUsageChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows fallback when memory API is not supported', () => {
    useMemoryDataMock.mockReturnValue({
      memoryData: { used: 0, total: 0, percentage: 0 },
      isSupported: false,
      isPaused: false,
      togglePause: vi.fn(),
      clearData: vi.fn(),
      error: null,
    });

    renderWithTheme(<MemoryUsageChart />);
    expect(
      screen.getByText('Memory monitoring not available in this browser')
    ).toBeInTheDocument();
  });

  it('renders current usage, totals and legend when supported', () => {
    useMemoryDataMock.mockReturnValue({
      memoryData: {
        used: 1024 * 1024 * 1024, // 1 GB
        total: 4 * 1024 * 1024 * 1024, // 4 GB
        percentage: 25.0,
        breakdown: { JavaScript: 1024 * 1024 * 1024 },
      },
      isSupported: true,
      isPaused: false,
      togglePause: vi.fn(),
      clearData: vi.fn(),
      error: null,
    });

    const { container } = renderWithTheme(<MemoryUsageChart showLegend />);

    expect(screen.getByText('Current Usage: 25.0%')).toBeInTheDocument();
    expect(container.textContent).toContain('1 GB');
    expect(container.textContent).toContain('4 GB');
    expect(screen.getByText('JavaScript')).toBeInTheDocument();

    // Canvas accessible label reflects percentage
    expect(
      screen.getByLabelText(/Memory usage chart showing 25.0% usage/i)
    ).toBeInTheDocument();
  });

  it('triggers pause/resume and clear actions', () => {
    const togglePause = vi.fn();
    const clearData = vi.fn();

    useMemoryDataMock.mockReturnValue({
      memoryData: {
        used: 1024 * 1024 * 1024,
        total: 4 * 1024 * 1024 * 1024,
        percentage: 25.0,
      },
      isSupported: true,
      isPaused: false,
      togglePause,
      clearData,
      error: null,
    });

    const { container } = renderWithTheme(<MemoryUsageChart />);

    const buttons = container.querySelectorAll('button');
    // 0: pause/resume, 1: clear, 2: zoom in (disabled), 3: zoom out (disabled)
    expect(buttons.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(buttons[0]);
    expect(togglePause).toHaveBeenCalledTimes(1);

    fireEvent.click(buttons[1]);
    expect(clearData).toHaveBeenCalledTimes(1);
  });
});
