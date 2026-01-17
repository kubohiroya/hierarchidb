import React from 'react';
import { Box } from '@mui/material';
import { useValueHistogram } from './useValueHistogram.js';

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
  barColor?: (input: {
    index: number;
    start: number;
    end: number;
    midpoint: number;
    count: number;
    maxCount: number;
  }) => string;
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
  barColor,
}) => {
  const {
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
  } = useValueHistogram({
    values,
    binCount,
    width,
    height,
    min,
    max,
  });

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
          const start = min + (idx / clampedBinCount) * (max - min);
          const end = min + ((idx + 1) / clampedBinCount) * (max - min);
          const midpoint = (start + end) / 2;
          const fill = barColor
            ? barColor({ index: idx, start, end, midpoint, count, maxCount: modeCount })
            : '#90caf9';
          return (
            <g key={idx}>
              <rect
                x={x}
                y={y}
                width={Math.max(barWidth - 1, 0)}
                height={barHeight}
                fill={fill}
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

        <line
          x1={lineXForValue(mean)}
          y1={chartPadding.top}
          x2={lineXForValue(mean)}
          y2={chartPadding.top + chartHeight}
          stroke="#f57c00"
          strokeDasharray="4 4"
          strokeWidth={1}
        />

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
