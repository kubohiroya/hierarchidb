import React from 'react';

const ANCHOR_EPSILON = 1e-6;
const DEFAULT_LINE_COLOR = '#0b5ed7';

interface AxisRange {
  min: number;
  max: number;
}

export interface ToneCurveAnchor {
  x: number;
  y: number;
}

export interface ToneCurveAxisMark {
  value: number;
  label: string;
}

export interface ToneCurveAxisRange {
  xRange: [number, number];
  yRange: [number, number];
}

export interface ToneCurveEditorProps extends ToneCurveAxisRange {
  width: number;
  height: number;
  xFixedValues?: Array<number | undefined>;
  yFixedValues?: Array<number | undefined>;
  xEndpointRange?: [number, number];
  yEndpointRange?: [number, number];
  xMarks?: Array<ToneCurveAxisMark>;
  yMarks?: Array<ToneCurveAxisMark>;
  xSnapStep?: number;
  ySnapStep?: number;
  lineColor?: string;
  anchorPointColor?: string;
  onChange?: (anchors: ReadonlyArray<ToneCurveAnchor>) => void;
  className?: string;
  style?: React.CSSProperties;
}

const toAxisRange = (value: [number, number], fallbackMin: number, fallbackMax: number): AxisRange => {
  const [a, b] = value;
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { min: fallbackMin, max: fallbackMax };
  }

  if (a === b) {
    return { min: Math.min(a, fallbackMin), max: Math.max(a, fallbackMax) };
  }

  return a < b ? { min: a, max: b } : { min: b, max: a };
};

const clampRangeInBase = (
  value: [number, number] | undefined,
  baseRange: AxisRange,
): AxisRange => {
  if (!value) {
    return { ...baseRange };
  }

  const normalized = toAxisRange(value, baseRange.min, baseRange.max);
  const clampedMin = clampInOrder(normalized.min, baseRange.min, baseRange.max);
  const clampedMax = clampInOrder(normalized.max, baseRange.min, baseRange.max);

  if (clampedMin === clampedMax) {
    return { ...baseRange };
  }

  return { min: clampedMin, max: clampedMax };
};

const clampInOrder = (value: number, min: number, max: number): number => {
  if (min > max) {
    return value;
  }

  return Math.min(max, Math.max(min, value));
};

const snapValue = (value: number, step: number | undefined): number => {
  const resolvedStep = step ?? 0;
  if (!Number.isFinite(resolvedStep) || resolvedStep === 0) {
    return value;
  }

  return Math.round(value / resolvedStep) * resolvedStep;
};

const normalizeAxisMarks = (
  marks: Array<ToneCurveAxisMark> | undefined,
  range: AxisRange,
): Array<ToneCurveAxisMark> => {
  if (!marks?.length) {
    return [];
  }

  return marks
    .filter((mark) => Number.isFinite(mark.value))
    .filter((mark) => mark.value >= range.min && mark.value <= range.max)
    .sort((a, b) => a.value - b.value);
};

const normalizeAxisValues = (
  values: Array<number | undefined> | undefined,
  length: number,
): Array<number | undefined> => {
  const result = new Array<number | undefined>(length).fill(undefined);
  if (!values) {
    return result;
  }

  for (let i = 0; i < Math.min(values.length, length); i += 1) {
    const candidate = values[i];
    result[i] = Number.isFinite(candidate) ? candidate : undefined;
  }

  return result;
};

export function ToneCurveEditor({
  width,
  height,
  xRange,
  yRange,
  xFixedValues,
  yFixedValues,
  xEndpointRange,
  yEndpointRange,
  xMarks,
  yMarks,
  xSnapStep,
  ySnapStep,
  lineColor,
  anchorPointColor,
  onChange,
  className,
  style,
}: ToneCurveEditorProps): React.JSX.Element {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const activeAnchorIndexRef = React.useRef<number | null>(null);

  const resolvedLineColor = lineColor ?? DEFAULT_LINE_COLOR;
  const resolvedAnchorPointColor = anchorPointColor ?? DEFAULT_LINE_COLOR;

  const baseXRange = React.useMemo(
    () => toAxisRange(xRange, 0, 1),
    [xRange[0], xRange[1]],
  );
  const baseYRange = React.useMemo(
    () => toAxisRange(yRange, 0, 1),
    [yRange[0], yRange[1]],
  );

  const normalizedXRange = React.useMemo(
    () => clampRangeInBase(xEndpointRange, baseXRange),
    [baseXRange.min, baseXRange.max, xEndpointRange?.[0], xEndpointRange?.[1]],
  );
  const normalizedYRange = React.useMemo(
    () => clampRangeInBase(yEndpointRange, baseYRange),
    [baseYRange.min, baseYRange.max, yEndpointRange?.[0], yEndpointRange?.[1]],
  );

  const normalizedXMarks = React.useMemo(
    () => normalizeAxisMarks(xMarks, normalizedXRange),
    [normalizedXRange.max, normalizedXRange.min, xMarks],
  );
  const normalizedYMarks = React.useMemo(
    () => normalizeAxisMarks(yMarks, normalizedYRange),
    [normalizedYRange.max, normalizedYRange.min, yMarks],
  );

  const targetAnchorCount = React.useMemo(
    () => Math.max(
      2,
      xFixedValues?.length ?? 0,
      yFixedValues?.length ?? 0,
    ),
    [xFixedValues?.length, yFixedValues?.length],
  );

  const fixedHorizontalValues = React.useMemo(
    () => normalizeAxisValues(xFixedValues, targetAnchorCount),
    [xFixedValues, targetAnchorCount],
  );
  const fixedVerticalValues = React.useMemo(
    () => normalizeAxisValues(yFixedValues, targetAnchorCount),
    [yFixedValues, targetAnchorCount],
  );

  const clamp = React.useCallback((value: number, min: number, max: number): number => {
    if (!Number.isFinite(value)) {
      return min;
    }
    if (min > max) {
      return value;
    }
    return Math.min(max, Math.max(min, value));
  }, []);

  const initialAnchors = React.useMemo(
    () => {
      const next: ToneCurveAnchor[] = [];
      const widthRange = normalizedXRange.max - normalizedXRange.min;
      const heightRange = normalizedYRange.max - normalizedYRange.min;

      for (let i = 0; i < targetAnchorCount; i += 1) {
        const isFirst = i === 0;
        const isLast = i === targetAnchorCount - 1;
        const defaultX = isFirst
          ? normalizedXRange.min
          : isLast
            ? normalizedXRange.max
            : normalizedXRange.min + (widthRange * i) / (targetAnchorCount - 1 || 1);
        const defaultY = isFirst
          ? normalizedYRange.min
          : isLast
            ? normalizedYRange.max
            : normalizedYRange.min + (heightRange * i) / (targetAnchorCount - 1 || 1);

        const fixedX = fixedHorizontalValues[i];
        const fixedY = fixedVerticalValues[i];

        next.push({
          x: fixedX === undefined
            ? snapValue(defaultX, xSnapStep)
            : clamp(fixedX, normalizedXRange.min, normalizedXRange.max),
          y: fixedY === undefined
            ? snapValue(defaultY, ySnapStep)
            : clamp(fixedY, normalizedYRange.min, normalizedYRange.max),
        });
      }

      return next;
    },
    [
      fixedHorizontalValues,
      fixedVerticalValues,
      xSnapStep,
      ySnapStep,
      normalizedXRange.max,
      normalizedXRange.min,
      normalizedYRange.max,
      normalizedYRange.min,
      targetAnchorCount,
      clamp,
    ],
  );

  const inner = React.useMemo(
    () => ({
      paddingLeft: 22,
      paddingRight: 16,
      paddingTop: 12,
      paddingBottom: 22,
      width: Math.max(width - 38, 80),
      height: Math.max(height - 34, 80),
    }),
    [width, height],
  );

  const xToScreen = React.useCallback(
    (x: number) => {
      const range = normalizedXRange.max - normalizedXRange.min;
      if (range === 0) {
        return inner.paddingLeft;
      }
      const ratio = (x - normalizedXRange.min) / range;
      return inner.paddingLeft + ratio * inner.width;
    },
    [normalizedXRange.max, normalizedXRange.min, inner],
  );

  const yToScreen = React.useCallback(
    (y: number) => {
      const range = normalizedYRange.max - normalizedYRange.min;
      if (range === 0) {
        return inner.paddingTop;
      }
      const ratio = (y - normalizedYRange.min) / range;
      return inner.paddingTop + (1 - ratio) * inner.height;
    },
    [normalizedYRange.max, normalizedYRange.min, inner],
  );

  const screenToData = React.useCallback(
    (clientX: number, clientY: number) => {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) {
        return null;
      }

      const x = normalizedXRange.min + ((clientX - svgRect.left - inner.paddingLeft) / inner.width) * (normalizedXRange.max - normalizedXRange.min);
      const y = normalizedYRange.max - ((clientY - svgRect.top - inner.paddingTop) / inner.height) * (normalizedYRange.max - normalizedYRange.min);
      return { x, y };
    },
    [inner, normalizedXRange.max, normalizedXRange.min, normalizedYRange.max, normalizedYRange.min],
  );

  const normalizeAnchors = React.useCallback(
    (
      values: ToneCurveAnchor[],
      fixedXValues: Array<number | undefined>,
      fixedYValues: Array<number | undefined>,
    ): ToneCurveAnchor[] => {
      if (values.length < 2) {
        return initialAnchors;
      }

      const count = values.length;
      const toFixedNumber = (list: Array<number | undefined>, index: number): number | undefined =>
        index >= 0 && index < list.length && Number.isFinite(list[index]) ? list[index] : undefined;

      const prepared = values.map((anchor, index) => {
        const fixedX = toFixedNumber(fixedXValues, index);
        const fixedY = toFixedNumber(fixedYValues, index);

        return {
          x: fixedX === undefined
            ? snapValue(anchor.x, xSnapStep)
            : clamp(fixedX, normalizedXRange.min, normalizedXRange.max),
          y: fixedY === undefined
            ? snapValue(anchor.y, ySnapStep)
            : clamp(fixedY, normalizedYRange.min, normalizedYRange.max),
        };
      });

      return prepared
        .map((anchor) => ({
          x: clamp(anchor.x, normalizedXRange.min, normalizedXRange.max),
          y: clamp(anchor.y, normalizedYRange.min, normalizedYRange.max),
        }))
        .sort((a, b) => a.x - b.x)
        .map((anchor, index, list) => {
          const fixedX = toFixedNumber(fixedXValues, index);
          const fixedY = toFixedNumber(fixedYValues, index);
          const isFirst = index === 0;
          const isLast = index === count - 1;

          const nextX = isFirst
            ? (fixedX === undefined ? normalizedXRange.min : clamp(fixedX, normalizedXRange.min, normalizedXRange.max))
            : isLast
              ? (fixedX === undefined ? normalizedXRange.max : clamp(fixedX, normalizedXRange.min, normalizedXRange.max))
              : Math.max(anchor.x, (list[index - 1]?.x ?? normalizedXRange.min) + ANCHOR_EPSILON);

          return {
            x: fixedX === undefined ? snapValue(nextX, xSnapStep) : nextX,
            y: fixedY === undefined
              ? snapValue(anchor.y, ySnapStep)
              : clamp(fixedY, normalizedYRange.min, normalizedYRange.max),
          };
        });
    },
    [clamp, initialAnchors, normalizedXRange.max, normalizedXRange.min, normalizedYRange.max, normalizedYRange.min, xSnapStep, ySnapStep],
  );

  const [anchors, setAnchors] = React.useState<ToneCurveAnchor[]>(initialAnchors);

  React.useEffect(() => {
    setAnchors(initialAnchors);
  }, [initialAnchors]);

  React.useEffect(() => {
    onChange?.(anchors);
  }, [anchors, onChange]);

  const sortedPoints = React.useMemo(
    () => [...anchors].sort((a, b) => a.x - b.x),
    [anchors],
  );

  const pathPoints = React.useMemo(
    () => sortedPoints.map((anchor) => `${xToScreen(anchor.x)},${yToScreen(anchor.y)}`).join(' '),
    [sortedPoints, xToScreen, yToScreen],
  );

  const fixedXForCount = React.useCallback(
    (count: number): Array<number | undefined> => {
      const next = new Array<number | undefined>(count).fill(undefined);
      for (let i = 0; i < count; i += 1) {
        next[i] = i < fixedHorizontalValues.length ? fixedHorizontalValues[i] : undefined;
      }
      return next;
    },
    [fixedHorizontalValues],
  );

  const fixedYForCount = React.useCallback(
    (count: number): Array<number | undefined> => {
      const next = new Array<number | undefined>(count).fill(undefined);
      for (let i = 0; i < count; i += 1) {
        next[i] = i < fixedVerticalValues.length ? fixedVerticalValues[i] : undefined;
      }
      return next;
    },
    [fixedVerticalValues],
  );

  const getAnchorCursor = React.useCallback(
    (index: number, count: number): string => {
      const fixedX = fixedXForCount(count)[index];
      const fixedY = fixedYForCount(count)[index];

      const canMoveX = fixedX === undefined;
      const canMoveY = fixedY === undefined;

      if (canMoveX && canMoveY) {
        return 'move';
      }

      if (canMoveX && !canMoveY) {
        return 'ew-resize';
      }

      if (!canMoveX && canMoveY) {
        return 'ns-resize';
      }

      return 'not-allowed';
    },
    [fixedXForCount, fixedYForCount],
  );

  const isDraggable = React.useCallback(
    (index: number, count: number): boolean => {
      const fixedX = fixedXForCount(count)[index];
      const fixedY = fixedYForCount(count)[index];
      return fixedX === undefined || fixedY === undefined;
    },
    [fixedXForCount, fixedYForCount],
  );

  const addAnchor = React.useCallback(() => {
    setAnchors((current) => {
      const list = [...current].sort((a, b) => a.x - b.x);
      if (list.length < 2) {
        return current;
      }

      let insertIndex = 0;
      let maxGap = -Infinity;

      for (let i = 0; i < list.length - 1; i += 1) {
        const left = list[i];
        const right = list[i + 1];
        if (!left || !right) {
          continue;
        }
        const gap = right.x - left.x;
        if (gap > maxGap) {
          maxGap = gap;
          insertIndex = i;
        }
      }

      const left = list[insertIndex];
      const right = list[insertIndex + 1];
      if (!left || !right) {
        return current;
      }

      const nextX = (left.x + right.x) / 2;
      const nextY = (left.y + right.y) / 2;
      const next = [...list];
      next.splice(insertIndex + 1, 0, { x: nextX, y: nextY });

      const nextCount = next.length;
      return normalizeAnchors(
        next,
        fixedXForCount(nextCount),
        fixedYForCount(nextCount),
      );
    });
  }, [fixedXForCount, fixedYForCount, normalizeAnchors]);

  const removeAnchor = React.useCallback(() => {
    setAnchors((current) => {
      if (current.length <= 2) {
        return current;
      }

      const index = Math.floor(current.length / 2);
      if (index <= 0 || index >= current.length - 1) {
        return current;
      }

      const next = [...current];
      next.splice(index, 1);

      return normalizeAnchors(
        next,
        fixedXForCount(next.length),
        fixedYForCount(next.length),
      );
    });
  }, [fixedXForCount, fixedYForCount, normalizeAnchors]);

  const updateAnchor = React.useCallback(
    (index: number, clientX: number, clientY: number) => {
      const point = screenToData(clientX, clientY);
      if (!point) {
        return;
      }

      setAnchors((current) => {
        if (index < 0 || index >= current.length) {
          return current;
        }

        const list = [...current];
        const target = list[index];
        const prev = index > 0 ? list[index - 1] : null;
        const next = index < list.length - 1 ? list[index + 1] : null;
        const isFirst = index === 0;
        const isLast = index === list.length - 1;
        const fixedX = fixedXForCount(list.length)[index];
        const fixedY = fixedYForCount(list.length)[index];

        const minX = isFirst
          ? normalizedXRange.min
          : prev
            ? prev.x + ANCHOR_EPSILON
            : normalizedXRange.min;
        const maxX = isLast
          ? normalizedXRange.max
          : next
            ? next.x - ANCHOR_EPSILON
            : normalizedXRange.max;

        const clampedX = fixedX === undefined
          ? clamp(point.x, minX, maxX)
          : clamp(fixedX, normalizedXRange.min, normalizedXRange.max);

        const clampedY = fixedY === undefined
          ? clamp(point.y, normalizedYRange.min, normalizedYRange.max)
          : clamp(fixedY, normalizedYRange.min, normalizedYRange.max);

        list[index] = {
          ...target,
          x: fixedX === undefined ? snapValue(clampedX, xSnapStep) : clampedX,
          y: fixedY === undefined ? snapValue(clampedY, ySnapStep) : clampedY,
        };

        return list;
      });
    },
    [clamp, fixedXForCount, fixedYForCount, normalizedXRange.max, normalizedXRange.min, normalizedYRange.max, normalizedYRange.min, screenToData, xSnapStep, ySnapStep],
  );

  const handlePointPointerDown = React.useCallback(
    (index: number) => (event: React.PointerEvent<SVGCircleElement>) => {
      if (!isDraggable(index, sortedPoints.length)) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      activeAnchorIndexRef.current = index;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [isDraggable, sortedPoints.length],
  );

  React.useEffect(() => {
    const onPointerMove = (event: PointerEvent): void => {
      const index = activeAnchorIndexRef.current;
      if (index === null) {
        return;
      }
      updateAnchor(index, event.clientX, event.clientY);
    };

    const onPointerUp = (): void => {
      activeAnchorIndexRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [updateAnchor]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width, ...style }} className={className}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" onClick={addAnchor} aria-label="Add anchor">
          +
        </button>
        <button type="button" onClick={removeAnchor} disabled={anchors.length <= 2} aria-label="Remove anchor">
          -
        </button>
        <span style={{ fontSize: 12 }}>{`Anchors: ${anchors.length}`}</span>
      </div>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label="Tone curve editor"
        style={{ border: '1px solid #d0d7de', borderRadius: 4, touchAction: 'none', backgroundColor: '#ffffff' }}
      >
        <line
          x1={inner.paddingLeft}
          y1={inner.paddingTop + inner.height}
          x2={inner.paddingLeft + inner.width}
          y2={inner.paddingTop + inner.height}
          stroke="#9ca3af"
          strokeWidth={1}
        />
        <line
          x1={inner.paddingLeft}
          y1={inner.paddingTop}
          x2={inner.paddingLeft}
          y2={inner.paddingTop + inner.height}
          stroke="#9ca3af"
          strokeWidth={1}
        />
        {normalizedXMarks.map((mark) => (
          <g key={`x-mark-${mark.value}-${mark.label}`}>
            <line
              x1={xToScreen(mark.value)}
              y1={inner.paddingTop + inner.height}
              x2={xToScreen(mark.value)}
              y2={inner.paddingTop + inner.height + 6}
              stroke="#64748b"
              strokeWidth={1}
            />
            <text
              x={xToScreen(mark.value)}
              y={inner.paddingTop + inner.height + 18}
              textAnchor="middle"
              fontSize={10}
              fill="#334155"
            >
              {mark.label}
            </text>
          </g>
        ))}
        {normalizedYMarks.map((mark) => (
          <g key={`y-mark-${mark.value}-${mark.label}`}>
            <line
              x1={inner.paddingLeft - 6}
              y1={yToScreen(mark.value)}
              x2={inner.paddingLeft}
              y2={yToScreen(mark.value)}
              stroke="#64748b"
              strokeWidth={1}
            />
            <text
              x={inner.paddingLeft - 10}
              y={yToScreen(mark.value) + 3}
              textAnchor="end"
              fontSize={10}
              fill="#334155"
            >
              {mark.label}
            </text>
          </g>
        ))}
        <polyline fill="none" stroke={resolvedLineColor} strokeWidth={2} points={pathPoints} />
        {sortedPoints.map((anchor, index) => {
          const cursor = getAnchorCursor(index, sortedPoints.length);
          return (
            <g key={`${index}`}>
              <circle
                cx={xToScreen(anchor.x)}
                cy={yToScreen(anchor.y)}
                r={5}
                fill={resolvedAnchorPointColor}
                stroke="#fff"
                strokeWidth={1.5}
                onPointerDown={handlePointPointerDown(index)}
                style={{ cursor }}
              />
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
        <span>{`x: [${normalizedXRange.min}, ${normalizedXRange.max}]`}</span>
        <span>{`y: [${normalizedYRange.min}, ${normalizedYRange.max}]`}</span>
      </div>
    </div>
  );
}
