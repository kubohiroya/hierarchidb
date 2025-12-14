import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';

interface ValueHistogramProps {
  values: number[];
  binCount: number;
  width: number;
  height: number;
  min: number;
  max: number;
  mean: number;
  valueLabel?: string;
  keyLabel?: string;
}

export const ValueHistogram: React.FC<ValueHistogramProps> = ({
  values,
  binCount,
  width,
  height,
  min,
  max,
  mean,
  valueLabel,
  keyLabel,
}) => {
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
  const scaleY = (count: number) =>
    modeCount === 0 ? 0 : (count / modeCount) * chartHeight;

  const lineXForValue = (value: number) => {
    if (max === min) return chartPadding.left;
    const ratio = (value - min) / (max - min);
    return chartPadding.left + ratio * chartWidth;
  };

  return (
    <Box sx={{ overflow: 'hidden' }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${Math.max(renderWidth, 1)} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        style={{ width: '100%', height }}
        ref={svgRef}
      >
        <rect
          x={chartPadding.left}
          y={chartPadding.top}
          width={chartWidth}
          height={chartHeight}
          fill="transparent"
          stroke="#ddd"
        />
        {bins.map((count, idx) => {
          const barHeight = scaleY(count);
          const x = chartPadding.left + idx * barWidth;
          const y = chartPadding.top + (chartHeight - barHeight);
          return (
            <g key={idx}>
              <rect
                x={x}
                y={y}
                width={Math.max(barWidth - 1, 0)}
                height={barHeight}
                fill="#90caf9"
              />
              {barHeight > 12 && (
                <text
                  x={x + Math.max(barWidth - 1, 0) / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#555"
                >
                  {count}
                </text>
              )}
            </g>
          );
        })}

        {/* Mean dotted line only */}
        {(() => {
          const x = lineXForValue(mean);
          return (
            <line
              x1={x}
              y1={chartPadding.top}
              x2={x}
              y2={chartPadding.top + chartHeight}
              stroke="#f57c00"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          );
        })()}

        {/* Axis labels */}
        {/* Axis labels */}
        <text
          x={chartPadding.left + chartWidth / 2}
          y={chartPadding.top + chartHeight + 36}
          textAnchor="middle"
          fontSize="11"
          fill="#555"
        >
          {valueLabel ?? 'Value'}
        </text>
        <text
          x={12}
          y={chartPadding.top + chartHeight / 2}
          textAnchor="start"
          fontSize="11"
          fill="#555"
          transform={`rotate(-90, 12, ${chartPadding.top + chartHeight / 2})`}
        >
          {keyLabel ?? 'frequency'}
        </text>
        {/* Min / Avg / Max labels along x-axis */}
        <text
          x={chartPadding.left}
          y={chartPadding.top + chartHeight + 20}
          textAnchor="start"
          fontSize="10"
          fill="#555"
        >
          {`min ${min.toFixed(2)}`}
        </text>
        <text
          x={lineXForValue(mean)}
          y={chartPadding.top + chartHeight + 32}
          textAnchor="middle"
          fontSize="10"
          fill="#555"
        >
          {`avg ${mean.toFixed(2)}`}
        </text>
        <text
          x={chartPadding.left + chartWidth}
          y={chartPadding.top + chartHeight + 20}
          textAnchor="end"
          fontSize="10"
          fill="#555"
        >
          {`max ${max.toFixed(2)}`}
        </text>
      </svg>
    </Box>
  );
};
