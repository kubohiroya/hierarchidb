import type React from 'react';
import { useId } from 'react';

interface GradientSwatchProps {
  stops: string[];
  width?: number;
  height?: number;
}

export const GradientSwatch: React.FC<GradientSwatchProps> = ({
  stops,
  width = 120,
  height = 16,
}) => {
  const gradientId = useId().replace(/:/g, '-');
  const safeStops = stops.length ? stops : ['#ffffff', '#000000'];
  const denom = Math.max(safeStops.length - 1, 1);

  return (
    <svg width={width} height={height} aria-hidden focusable="false">
      <title>Gradient Swatch</title>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          {safeStops.map((c, idx) => (
            <stop key={`${c}`} offset={`${(idx / denom) * 100}%`} stopColor={c} />
          ))}
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={width} height={height} rx={3} fill={`url(#${gradientId})`} stroke="#ccc" />
    </svg>
  );
};
