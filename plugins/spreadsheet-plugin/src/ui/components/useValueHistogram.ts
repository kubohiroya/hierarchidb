import { useEffect, useMemo, useRef, useState } from 'react';

interface UseValueHistogramProps {
  values: number[];
  binCount: number;
  width: number;
  height: number;
  min: number;
  max: number;
}

export function useValueHistogram({
  values,
  binCount,
  width,
  height,
  min,
  max,
}: UseValueHistogramProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [renderWidth, setRenderWidth] = useState<number>(width);

  useEffect(() => {
    const node = svgRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const update = (target: Element) => {
      const measured = target.getBoundingClientRect().width;
      if (measured > 0) {
        setRenderWidth(measured);
      }
    };
    update(node);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry?.target) {
        update(entry.target);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [width]);

  const clampedBinCount = Math.min(Math.max(binCount, 1), 256);
  const chartPadding = { top: 20, right: 16, bottom: 48, left: 56 };
  const chartWidth = Math.max(renderWidth - chartPadding.left - chartPadding.right, 10);
  const chartHeight = Math.max(height - chartPadding.top - chartPadding.bottom, 10);

  const { bins, modeCount } = useMemo(() => {
    if (values.length === 0 || min === max) {
      return { bins: new Array(clampedBinCount).fill(0), modeCount: 0 };
    }
    const counts = new Array(clampedBinCount).fill(0);
    const range = max - min;
    for (const val of values) {
      const idx = Math.min(
        clampedBinCount - 1,
        Math.floor(((val - min) / range) * clampedBinCount)
      );
      counts[idx] += 1;
    }
    const mode = counts.reduce((m, v) => (v > m ? v : m), 0);
    return { bins: counts, modeCount: mode };
  }, [clampedBinCount, max, min, values]);

  const barWidth = chartWidth / clampedBinCount;
  const scaleY = (count: number) => (modeCount === 0 ? 0 : (count / modeCount) * chartHeight);

  const lineXForValue = (value: number) => {
    if (max === min) return chartPadding.left;
    const ratio = (value - min) / (max - min);
    return chartPadding.left + ratio * chartWidth;
  };

  return {
    barWidth,
    bins,
    chartHeight,
    chartPadding,
    chartWidth,
    clampedBinCount,
    lineXForValue,
    modeCount,
    renderWidth,
    scaleY,
    svgRef,
  };
}
