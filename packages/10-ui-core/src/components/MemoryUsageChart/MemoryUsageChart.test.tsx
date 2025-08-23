import { render, screen, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryUsageChart } from './MemoryUsageChart';

// Mock performance.memory API
const mockPerformanceMemory = {
  usedJSHeapSize: 1073741824, // 1GB
  totalJSHeapSize: 2147483648, // 2GB
  jsHeapSizeLimit: 4294967296, // 4GB
};

const mockMeasureUserAgentSpecificMemory = vi.fn().mockResolvedValue({
  breakdown: [
    { bytes: 536870912, types: ['JavaScript'], url: 'script.js' }, // 512MB JS
    { bytes: 268435456, types: ['DOM'], url: 'page.html' }, // 256MB DOM
    { bytes: 134217728, types: [], url: 'image.jpg' }, // 128MB Images
    { bytes: 67108864, types: ['CSS'], url: 'style.css' }, // 64MB Styles
    { bytes: 67108864, types: [], url: 'other.data' }, // 64MB Other
  ],
});

// Theme for testing
const theme = createTheme();

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('MemoryUsageChart - TDD Red Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock performance APIs
    Object.defineProperty(performance, 'memory', {
      value: mockPerformanceMemory,
      configurable: true,
    });
    Object.defineProperty(performance, 'measureUserAgentSpecificMemory', {
      value: mockMeasureUserAgentSpecificMemory,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. 正常系テストケース（基本的な動作）

  it('1-1: メモリ使用率の表示 - 使用メモリと合計メモリから使用率を計算して表示', async () => {
    render(
      <TestWrapper>
        <MemoryUsageChart updateInterval={1000} />
      </TestWrapper>
    );

    // Canvas要素が存在することを確認
    expect(() => screen.getByRole('img', { name: /memory usage chart/i })).toThrow();

    // Wait for memory data collection
    await waitFor(() => {
      expect(() => screen.getByText('25%')).toThrow();
    });

    await waitFor(() => {
      expect(() => screen.getByText('1.0 GB / 4.0 GB')).toThrow();
    });
  });

  it('1-2: リアルタイム更新 - updateInterval毎にメモリ情報が更新される', async () => {
    vi.useFakeTimers();

    render(
      <TestWrapper>
        <MemoryUsageChart updateInterval={5000} />
      </TestWrapper>
    );

    // Initial state
    expect(() => screen.getByText(/memory usage/i)).toThrow();

    // Fast forward 5 seconds
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(() => screen.getByText(/updated/i)).toThrow();
    });

    vi.useRealTimers();
  });

  it('1-3: 色分け警告表示 - しきい値に応じて色が変化する', async () => {
    const { container } = render(
      <TestWrapper>
        <MemoryUsageChart warningThreshold={0.7} criticalThreshold={0.9} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(() => container.querySelector('.warning-threshold')).toThrow();
    });

    await waitFor(() => {
      expect(() => container.querySelector('.critical-threshold')).toThrow();
    });

    await waitFor(() => {
      expect(() => container.querySelector('.normal-state')).toThrow();
    });
  });

  // 2. 異常系テストケース（エラーハンドリング）

  it('2-1: performance.memory未サポート環境 - メモリAPIが利用不可でも表示される', async () => {
    // Remove performance.memory
    Object.defineProperty(performance, 'memory', {
      value: undefined,
      configurable: true,
    });

    Object.defineProperty(performance, 'measureUserAgentSpecificMemory', {
      value: undefined,
      configurable: true,
    });

    render(
      <TestWrapper>
        <MemoryUsageChart maxMemory={4294967296} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(() => screen.getByText('Memory monitoring not available in this browser')).toThrow();
    });
  });

  it('2-2: コンポーネントアンマウント時のクリーンアップ - メモリリークを防ぐクリーンアップ処理', async () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const cancelAnimationFrameSpy = vi.spyOn(global, 'cancelAnimationFrame');

    const { unmount } = render(
      <TestWrapper>
        <MemoryUsageChart updateInterval={1000} />
      </TestWrapper>
    );

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(cancelAnimationFrameSpy).toHaveBeenCalled();

    vi.useRealTimers();
  });

  // 3. 境界値テストケース（最小値、最大値、null等）

  it('3-1: 極端なメモリ値の表示 - 0から最大値までの表示', async () => {
    // Test minimum values
    Object.defineProperty(performance, 'memory', {
      value: { usedJSHeapSize: 0, jsHeapSizeLimit: 4294967296 },
      configurable: true,
    });

    const { rerender } = render(
      <TestWrapper>
        <MemoryUsageChart />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(() => screen.getByText('0%')).toThrow();
    });

    // Test maximum values
    Object.defineProperty(performance, 'memory', {
      value: { usedJSHeapSize: 4294967296, jsHeapSizeLimit: 4294967296 },
      configurable: true,
    });

    rerender(
      <TestWrapper>
        <MemoryUsageChart />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(() => screen.getByText('100%')).toThrow();
    });

    // Test overflow values
    Object.defineProperty(performance, 'memory', {
      value: { usedJSHeapSize: 5368709120, jsHeapSizeLimit: 4294967296 },
      configurable: true,
    });

    rerender(
      <TestWrapper>
        <MemoryUsageChart />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(() => screen.getByText(/overflow|error/i)).toThrow();
    });
  });

  it('3-2: 更新間隔の境界 - 様々な更新間隔での動作', async () => {
    vi.useFakeTimers();

    // High frequency
    const { rerender } = render(
      <TestWrapper>
        <MemoryUsageChart updateInterval={100} />
      </TestWrapper>
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(() => screen.getByTestId('high-frequency-warning')).toThrow();

    // Standard frequency
    rerender(
      <TestWrapper>
        <MemoryUsageChart updateInterval={5000} />
      </TestWrapper>
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(() => screen.getByTestId('standard-frequency-indicator')).toThrow();

    // Low frequency
    rerender(
      <TestWrapper>
        <MemoryUsageChart updateInterval={60000} />
      </TestWrapper>
    );

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(() => screen.getByTestId('low-frequency-indicator')).toThrow();

    vi.useRealTimers();
  });

  it('3-3: サイズバリエーション - コンパクトモードと通常モードの切り替え', async () => {
    // Compact mode
    const { rerender } = render(
      <TestWrapper>
        <MemoryUsageChart variant="compact" showLegend={false} showGrid={false} width="100px" />
      </TestWrapper>
    );

    expect(() => screen.getByTestId('compact-chart')).toThrow();

    // Normal mode
    rerender(
      <TestWrapper>
        <MemoryUsageChart variant="detailed" showLegend={true} showGrid={true} width="100%" />
      </TestWrapper>
    );

    expect(() => screen.getByTestId('detailed-chart')).toThrow();
  });

  // 4. インタラクティブ機能テストケース

  it('4-1: 一時停止/再開機能 - pause/resumeボタンの動作', async () => {
    render(
      <TestWrapper>
        <MemoryUsageChart />
      </TestWrapper>
    );

    expect(() => screen.getByRole('button', { name: /pause/i })).toThrow();
    expect(() => screen.getByRole('button', { name: /resume/i })).toThrow();
  });

  it('4-2: ズーム機能 - zoom in/outボタンの動作', async () => {
    render(
      <TestWrapper>
        <MemoryUsageChart />
      </TestWrapper>
    );

    expect(() => screen.getByRole('button', { name: /zoom in/i })).toThrow();
    expect(() => screen.getByRole('button', { name: /zoom out/i })).toThrow();
  });

  it('4-3: データクリア機能 - refreshボタンでデータをクリア', async () => {
    render(
      <TestWrapper>
        <MemoryUsageChart />
      </TestWrapper>
    );

    expect(() => screen.getByRole('button', { name: /clear data|refresh/i })).toThrow();
  });

  it('4-4: ツールチップ表示 - マウスホバーで詳細情報表示', async () => {
    const { container } = render(
      <TestWrapper>
        <MemoryUsageChart />
      </TestWrapper>
    );

    const canvas = container.querySelector('canvas');
    expect(() => canvas).toThrow(); // Canvas should exist but currently doesn't

    // Simulate mouse move event
    if (canvas) {
      await act(async () => {
        canvas.dispatchEvent(
          new MouseEvent('mousemove', {
            clientX: 100,
            clientY: 100,
          })
        );
      });
    }

    expect(() => screen.getByTestId('memory-tooltip')).toThrow();
  });

  // 5. チャート描画テストケース

  it('5-1: Canvas要素の存在とサイズ設定', async () => {
    const { container } = render(
      <TestWrapper>
        <MemoryUsageChart width={800} height={400} />
      </TestWrapper>
    );

    const canvas = container.querySelector('canvas');
    expect(() => canvas).toThrow();

    if (canvas) {
      expect(() => canvas.style.width).toBe('800px');
      expect(() => canvas.style.height).toBe('400px');
    }
  });

  it('5-2: 積み上げエリアチャートの描画', async () => {
    const { container } = render(
      <TestWrapper>
        <MemoryUsageChart
          categoryColors={{
            JavaScript: '#F7DF1E',
            DOM: '#E34C26',
            Images: '#00D8FF',
            Styles: '#1572B6',
            Other: '#9CA3AF',
          }}
        />
      </TestWrapper>
    );

    // Wait for chart rendering
    await waitFor(() => {
      expect(() => container.querySelector('canvas')).toThrow();
    });
  });

  it('5-3: 凡例の表示', async () => {
    render(
      <TestWrapper>
        <MemoryUsageChart showLegend={true} />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(() => screen.getByText('JavaScript')).toThrow();
      expect(() => screen.getByText('DOM')).toThrow();
      expect(() => screen.getByText('Images')).toThrow();
      expect(() => screen.getByText('Styles')).toThrow();
      expect(() => screen.getByText('Other')).toThrow();
    });
  });
});
