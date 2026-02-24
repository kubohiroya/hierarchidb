import React from 'react';

const ANCHOR_EPSILON = 1e-6;
const DEFAULT_LINE_COLOR = '#0b5ed7';
const DEFAULT_SECONDARY_LINE_COLOR = '#ef4444';
const DEFAULT_SECONDARY_LINE_DASH = '6 4';
const DEFAULT_STROKE_WIDTH = 2;

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

export interface ToneCurveLineStyle {
  lineColor?: string;
  anchorPointColor?: string;
  lineWidth?: number;
  lineDashArray?: string;
}

export interface ToneCurveEditorProps extends ToneCurveAxisRange {
  width: number;
  height: number;
  anchors?: ReadonlyArray<ToneCurveAnchor>;
  xFixedValues?: Array<number | undefined>;
  yFixedValues?: Array<number | undefined>;
  xEndpointRange?: [number, number];
  yEndpointRange?: [number, number];
  xMarks?: Array<ToneCurveAxisMark>;
  yMarks?: Array<ToneCurveAxisMark>;
  xSnapStep?: number;
  ySnapStep?: number;
  allowAnchorCountChange?: boolean;
  lineColor?: string;
  anchorPointColor?: string;
  onChange?: (anchors: ReadonlyArray<ToneCurveAnchor>) => void;
  lineStyles?: ReadonlyArray<ToneCurveLineStyle>;
  overlaySeries?: ReadonlyArray<ToneCurveOverlaySeries>;
  className?: string;
  style?: React.CSSProperties;
}

export interface ToneCurveOverlaySeries {
  anchors?: ReadonlyArray<ToneCurveAnchor>;
  xFixedValues?: Array<number | undefined>;
  yFixedValues?: Array<number | undefined>;
  allowAnchorCountChange?: boolean;
  lineColor?: string;
  anchorPointColor?: string;
  lineWidth?: number;
  lineDashArray?: string;
  editable?: boolean;
  onChange?: (anchors: ReadonlyArray<ToneCurveAnchor>) => void;
}

type ResolvedOverlaySeries = {
  anchors: ReadonlyArray<ToneCurveAnchor>;
  xFixedValues: Array<number | undefined>;
  yFixedValues: Array<number | undefined>;
  lineColor: string;
  anchorPointColor: string;
  lineWidth: number;
  lineDashArray?: string;
  editable: boolean;
  allowAnchorCountChange: boolean;
  onChange?: (anchors: ReadonlyArray<ToneCurveAnchor>) => void;
};

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

const formatAnchorValueLabel = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '';
  }

  if (Math.abs(value - Math.round(value)) < 1e-9) {
    return String(Math.round(value));
  }

  return String(Number.parseFloat(value.toFixed(3)));
};

const areAnchorsEqual = (left: ReadonlyArray<ToneCurveAnchor>, right: ReadonlyArray<ToneCurveAnchor>): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i += 1) {
    if (left[i]?.x !== right[i]?.x || left[i]?.y !== right[i]?.y) {
      return false;
    }
  }
  return true;
};

export function ToneCurveEditor({
  width,
  height,
  anchors: externalAnchors,
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
  allowAnchorCountChange = true,
  lineColor,
  anchorPointColor,
  onChange,
  lineStyles = [],
  overlaySeries = [],
  className,
  style,
}: ToneCurveEditorProps): React.JSX.Element {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const activeAnchorRef = React.useRef<{
    type: 'main' | 'overlay';
    curveIndex: number | null;
    anchorIndex: number;
  } | null>(null);

  const getLineStyle = React.useCallback(
    (curveIndex: number): {
      lineColor: string;
      anchorPointColor: string;
      lineWidth: number;
      lineDashArray?: string;
    } => {
      const configured = lineStyles[curveIndex];
      const isPrimary = curveIndex === 0;
      const defaultLineColor = isPrimary
        ? (lineColor ?? DEFAULT_LINE_COLOR)
        : curveIndex === 1
          ? DEFAULT_SECONDARY_LINE_COLOR
          : DEFAULT_LINE_COLOR;
      const defaultDashArray = isPrimary ? undefined : (curveIndex === 1 ? DEFAULT_SECONDARY_LINE_DASH : undefined);
      const defaultAnchorColor = isPrimary
        ? (anchorPointColor ?? DEFAULT_LINE_COLOR)
        : defaultLineColor;

      const resolvedLineColor = configured?.lineColor ?? defaultLineColor;
      const resolvedAnchorColor = configured?.anchorPointColor ?? defaultAnchorColor;

      return {
        lineColor: resolvedLineColor,
        anchorPointColor: resolvedAnchorColor,
        lineWidth: configured?.lineWidth ?? DEFAULT_STROKE_WIDTH,
        lineDashArray: configured?.lineDashArray ?? defaultDashArray,
      };
    },
    [anchorPointColor, lineColor, lineStyles],
  );

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

  const resolveTargetAnchorCount = React.useCallback(
    (xValues: Array<number | undefined> | undefined, yValues: Array<number | undefined> | undefined): number => Math.max(
      2,
      xValues?.length ?? 0,
      yValues?.length ?? 0,
    ),
    [],
  );
  const resolvedOverlaySeriesInput = React.useMemo(
    () => (Array.isArray(overlaySeries) ? overlaySeries : []),
    [overlaySeries],
  );
  const normalizeFixedValueArray = React.useCallback((
    values: ReadonlyArray<number | undefined> | Array<number | undefined> | undefined,
  ): Array<number | undefined> => (
    Array.isArray(values) ? values : []
  ), []);
  const normalizeAnchorArray = React.useCallback((
    points: ReadonlyArray<ToneCurveAnchor> | ToneCurveAnchor[] | undefined,
  ): ToneCurveAnchor[] => (
    Array.isArray(points) ? [...points] : []
  ), []);

  const targetAnchorCount = React.useMemo(
    () => resolveTargetAnchorCount(xFixedValues, yFixedValues),
    [resolveTargetAnchorCount, xFixedValues, yFixedValues],
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

  const createAnchorsFromInputs = React.useCallback(
    (
      externalAnchors: ReadonlyArray<ToneCurveAnchor> | undefined,
      fixedXValues: Array<number | undefined> = [],
      fixedYValues: Array<number | undefined> = [],
    ): ToneCurveAnchor[] => {
      const safeFixedXValues = normalizeFixedValueArray(fixedXValues);
      const safeFixedYValues = normalizeFixedValueArray(fixedYValues);
      const count = resolveTargetAnchorCount(safeFixedXValues, safeFixedYValues);
      const normalizedFixedX = normalizeAxisValues(safeFixedXValues, count);
      const normalizedFixedY = normalizeAxisValues(safeFixedYValues, count);
      const next: ToneCurveAnchor[] = [];
      const widthRange = normalizedXRange.max - normalizedXRange.min;
      const heightRange = normalizedYRange.max - normalizedYRange.min;

      for (let i = 0; i < count; i += 1) {
        const externalAnchor = externalAnchors?.[i];
        const externalAnchorX = externalAnchor && Number.isFinite(externalAnchor.x) ? externalAnchor.x : undefined;
        const externalAnchorY = externalAnchor && Number.isFinite(externalAnchor.y) ? externalAnchor.y : undefined;
        const isFirst = i === 0;
        const isLast = i === count - 1;
        const defaultX = isFirst
          ? normalizedXRange.min
          : isLast
            ? normalizedXRange.max
            : normalizedXRange.min + (widthRange * i) / (count - 1 || 1);
        const defaultY = isFirst
          ? normalizedYRange.min
          : isLast
            ? normalizedYRange.max
            : normalizedYRange.min + (heightRange * i) / (count - 1 || 1);

        const fixedX = normalizedFixedX[i];
        const fixedY = normalizedFixedY[i];

        next.push({
          x: fixedX === undefined
            ? snapValue(externalAnchorX ?? defaultX, xSnapStep)
            : clamp(fixedX, normalizedXRange.min, normalizedXRange.max),
          y: fixedY === undefined
            ? snapValue(externalAnchorY ?? defaultY, ySnapStep)
            : clamp(fixedY, normalizedYRange.min, normalizedYRange.max),
        });
      }

      return next;
    },
    [
      clamp,
      normalizedXRange.max,
      normalizedXRange.min,
      normalizedYRange.max,
      normalizedYRange.min,
      normalizeFixedValueArray,
      resolveTargetAnchorCount,
      xSnapStep,
      ySnapStep,
    ],
  );

  const initialAnchors = React.useMemo(
    () => createAnchorsFromInputs(externalAnchors, fixedHorizontalValues, fixedVerticalValues),
    [createAnchorsFromInputs, externalAnchors, fixedHorizontalValues, fixedVerticalValues],
  );

  const inner = React.useMemo(
    () => ({
      paddingLeft: 54,
      paddingRight: 16,
      paddingTop: 12,
      paddingBottom: 22,
      width: Math.max(width - 70, 80),
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
      fallbackAnchors: ToneCurveAnchor[] = initialAnchors,
    ): ToneCurveAnchor[] => {
      if (values.length < 2) {
        return fallbackAnchors;
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
  const previousAnchorsRef = React.useRef<ToneCurveAnchor[]>(initialAnchors);
  const resolvedOverlaySeries = React.useMemo(
    () => resolvedOverlaySeriesInput.map((overlaySeriesItem, overlayIndex) => {
      const safeSeries: ToneCurveOverlaySeries = overlaySeriesItem ?? {};
      const safeCount = resolveTargetAnchorCount(
        normalizeFixedValueArray(safeSeries.xFixedValues),
        normalizeFixedValueArray(safeSeries.yFixedValues),
      );
      const fixedXValues = normalizeAxisValues(
        normalizeFixedValueArray(safeSeries.xFixedValues),
        safeCount,
      );
      const fixedYValues = normalizeAxisValues(
        normalizeFixedValueArray(safeSeries.yFixedValues),
        safeCount,
      );
      const resolvedStyle = getLineStyle(overlayIndex + 1);
      const resolvedLineColor = safeSeries.lineColor ?? resolvedStyle.lineColor;
      const resolvedAnchorPointColor = safeSeries.anchorPointColor
        ?? resolvedLineColor
        ?? resolvedStyle.anchorPointColor;

      return {
        anchors: safeSeries.anchors ?? [],
        xFixedValues,
        yFixedValues,
        allowAnchorCountChange: safeSeries.allowAnchorCountChange ?? false,
        lineColor: resolvedLineColor,
        anchorPointColor: resolvedAnchorPointColor,
        lineWidth: safeSeries.lineWidth ?? resolvedStyle.lineWidth,
        lineDashArray: safeSeries.lineDashArray ?? resolvedStyle.lineDashArray,
        editable: safeSeries.editable ?? true,
        onChange: safeSeries.onChange,
      };
    }),
    [normalizeFixedValueArray, getLineStyle, resolvedOverlaySeriesInput, resolveTargetAnchorCount],
  );
  const [overlayAnchors, setOverlayAnchors] = React.useState<ToneCurveAnchor[][]>(() =>
    resolvedOverlaySeries.map((series) => createAnchorsFromInputs(series.anchors, series.xFixedValues, series.yFixedValues)),
  );
  const syncedOverlaySignatureRef = React.useRef<string>('');

  const overlaySignature = React.useMemo(
    () => resolvedOverlaySeries
      .map((series, index) => {
        const style = getLineStyle(index + 1);
        const anchorsSignature = series.anchors
          ?.map((anchor) => `${Number.isFinite(anchor.x) ? anchor.x : ''}:${Number.isFinite(anchor.y) ? anchor.y : ''}`)
          .join('|') ?? '';
        const xFixedValueCount = (series.xFixedValues ?? []).length;
        const yFixedValueCount = (series.yFixedValues ?? []).length;

        return `${xFixedValueCount}-${yFixedValueCount}-${series.lineColor ?? style.lineColor}-${series.anchorPointColor ?? style.anchorPointColor}-${series.lineWidth}-${series.lineDashArray ?? style.lineDashArray ?? ''}-${series.editable}-${anchorsSignature}`;
      })
      .join('||'),
    [resolvedOverlaySeries, getLineStyle],
  );

  React.useEffect(() => {
    if (overlaySignature === syncedOverlaySignatureRef.current) {
      return;
    }

    syncedOverlaySignatureRef.current = overlaySignature;
    setOverlayAnchors(
      resolvedOverlaySeries.map((series) => createAnchorsFromInputs(
        series.anchors,
        series.xFixedValues,
        series.yFixedValues,
      )),
    );
  }, [createAnchorsFromInputs, overlaySignature, resolvedOverlaySeries]);

  const fixedXSignature = React.useMemo(
    () => fixedHorizontalValues.map((value) => (Number.isFinite(value) ? `${value}` : '')).join('|'),
    [fixedHorizontalValues],
  );
  const externalAnchorsSignature = React.useMemo(
    () => externalAnchors
      ?.map((anchor) => `${Number.isFinite(anchor.x) ? anchor.x : ''}:${Number.isFinite(anchor.y) ? anchor.y : ''}`)
      .join('|') ?? '',
    [externalAnchors],
  );
  const syncedFixedSignatureRef = React.useRef<string>(fixedXSignature);
  const syncedAnchorsSignatureRef = React.useRef<string>(externalAnchorsSignature);
  const syncedAnchorCountRef = React.useRef<number>(initialAnchors.length);

  React.useEffect(() => {
    if (
      fixedXSignature === syncedFixedSignatureRef.current
      && externalAnchorsSignature === syncedAnchorsSignatureRef.current
      && syncedAnchorCountRef.current === initialAnchors.length
    ) {
      return;
    }

    syncedFixedSignatureRef.current = fixedXSignature;
    syncedAnchorsSignatureRef.current = externalAnchorsSignature;
    syncedAnchorCountRef.current = initialAnchors.length;
    setAnchors(initialAnchors);
  }, [externalAnchorsSignature, initialAnchors, fixedXSignature]);

  React.useEffect(() => {
    if (!onChange) {
      return;
    }
    if (areAnchorsEqual(previousAnchorsRef.current, anchors)) {
      return;
    }
    previousAnchorsRef.current = anchors;
    onChange(anchors);
  }, [anchors, onChange]);

  const sortedPoints = React.useMemo(
    () => [...anchors].sort((a, b) => a.x - b.x),
    [anchors],
  );

  const sortedOverlayPoints = React.useMemo(
    () => (Array.isArray(overlayAnchors) ? overlayAnchors : [])
      .map((curveAnchors) => normalizeAnchorArray(curveAnchors).sort((a, b) => a.x - b.x)),
    [overlayAnchors, normalizeAnchorArray],
  );

  const pathPoints = React.useMemo(
    () => sortedPoints.map((anchor) => `${xToScreen(anchor.x)},${yToScreen(anchor.y)}`).join(' '),
    [sortedPoints, xToScreen, yToScreen],
  );
  const overlayPathPoints = React.useMemo(
    () => sortedOverlayPoints.map(
      (points) => normalizeAnchorArray(points).map((anchor) => `${xToScreen(anchor.x)},${yToScreen(anchor.y)}`).join(' '),
    ),
    [normalizeAnchorArray, sortedOverlayPoints, xToScreen, yToScreen],
  );
  const anchorYMarks = React.useMemo(() => {
    const dedupeEpsilon = 1e-9;
    const raw = anchors.map((anchor) => anchor.y).filter((value) => Number.isFinite(value));
    const uniqueSorted = raw
      .filter((value, index, values) => values.findIndex((candidate) => Math.abs(candidate - value) <= dedupeEpsilon) === index)
      .sort((left, right) => right - left);

    return uniqueSorted.map((value) => ({
      value,
      label: formatAnchorValueLabel(value),
    }));
  }, [anchors]);

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

  const fixedXForOverlayCount = React.useCallback(
    (curve: ResolvedOverlaySeries | undefined, count: number): Array<number | undefined> => {
      const next = new Array<number | undefined>(count).fill(undefined);
      const fixedValues = curve?.xFixedValues ?? [];
      for (let i = 0; i < count; i += 1) {
        next[i] = i < fixedValues.length ? fixedValues[i] : undefined;
      }
      return next;
    },
    [],
  );

  const fixedYForOverlayCount = React.useCallback(
    (curve: ResolvedOverlaySeries | undefined, count: number): Array<number | undefined> => {
      const next = new Array<number | undefined>(count).fill(undefined);
      const fixedValues = curve?.yFixedValues ?? [];
      for (let i = 0; i < count; i += 1) {
        next[i] = i < fixedValues.length ? fixedValues[i] : undefined;
      }
      return next;
    },
    [],
  );

  const getAnchorCursor = React.useCallback(
    (
      index: number,
      count: number,
      type: 'main' | 'overlay',
      overlayIndex: number | null,
      editable: boolean,
    ): string => {
      if (!editable) {
        return 'not-allowed';
      }
      const overlayCurve = overlayIndex === null
        ? undefined
        : resolvedOverlaySeries[overlayIndex];

      const fixedX = type === 'main'
        ? fixedXForCount(count)[index]
        : overlayCurve
          ? fixedXForOverlayCount(overlayCurve, count)[index]
          : undefined;
      const fixedY = type === 'main'
        ? fixedYForCount(count)[index]
        : overlayCurve
          ? fixedYForOverlayCount(overlayCurve, count)[index]
          : undefined;

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
    [fixedXForCount, fixedYForCount, fixedXForOverlayCount, fixedYForOverlayCount, resolvedOverlaySeries],
  );

  const isDraggable = React.useCallback(
    (
      index: number,
      count: number,
      type: 'main' | 'overlay',
      overlayIndex: number | null,
      editable: boolean,
    ): boolean => {
      if (!editable) {
        return false;
      }

      const overlayCurve = overlayIndex === null
        ? undefined
        : resolvedOverlaySeries[overlayIndex];

      const fixedX = type === 'main'
        ? fixedXForCount(count)[index]
        : overlayCurve
          ? fixedXForOverlayCount(overlayCurve, count)[index]
          : undefined;
      const fixedY = type === 'main'
        ? fixedYForCount(count)[index]
        : overlayCurve
          ? fixedYForOverlayCount(overlayCurve, count)[index]
          : undefined;
      return fixedX === undefined || fixedY === undefined;
    },
    [fixedXForCount, fixedYForCount, fixedXForOverlayCount, fixedYForOverlayCount, resolvedOverlaySeries],
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
    (curveType: 'main' | 'overlay', anchorIndex: number, overlayIndex: number | null, clientX: number, clientY: number) => {
      const point = screenToData(clientX, clientY);
      if (!point) {
        return;
      }

      if (curveType === 'main') {
        setAnchors((current) => {
          const index = anchorIndex;
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
        return;
      }

      if (overlayIndex === null || overlayIndex < 0 || overlayIndex >= resolvedOverlaySeries.length) {
        return;
      }

      const overlayCurve = resolvedOverlaySeries[overlayIndex];
      if (!overlayCurve) {
        return;
      }

      const fallbackAnchors = createAnchorsFromInputs(
        overlayCurve.anchors,
        overlayCurve.xFixedValues,
        overlayCurve.yFixedValues,
      );

      setOverlayAnchors((current) => {
        const currentCurve = current[overlayIndex];
        if (!currentCurve) {
          return current;
        }

        const list = [...currentCurve].sort((left, right) => left.x - right.x);
        const index = anchorIndex;
        if (index < 0 || index >= list.length) {
          return current;
        }

        const target = list[index];
        const prev = index > 0 ? list[index - 1] : null;
        const next = index < list.length - 1 ? list[index + 1] : null;
        const isFirst = index === 0;
        const isLast = index === list.length - 1;
        const fixedX = fixedXForOverlayCount(overlayCurve, list.length)[index];
        const fixedY = fixedYForOverlayCount(overlayCurve, list.length)[index];
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

        const nextCurve = [...list];
        nextCurve[index] = {
          ...target,
          x: fixedX === undefined ? snapValue(clampedX, xSnapStep) : clampedX,
          y: fixedY === undefined ? snapValue(clampedY, ySnapStep) : clampedY,
        };

        const normalizedCurve = normalizeAnchors(
          nextCurve,
          fixedXForOverlayCount(overlayCurve, nextCurve.length),
          fixedYForOverlayCount(overlayCurve, nextCurve.length),
          fallbackAnchors,
        );
        const nextAnchors = [...current];
        nextAnchors[overlayIndex] = normalizedCurve;
        if (overlayCurve.onChange) {
          overlayCurve.onChange(normalizedCurve);
        }
        return nextAnchors;
      });
    },
    [
      clamp,
      createAnchorsFromInputs,
      fixedXForCount,
      fixedYForCount,
      fixedXForOverlayCount,
      fixedYForOverlayCount,
      normalizeAnchors,
      normalizedXRange.max,
      normalizedXRange.min,
      normalizedYRange.max,
      normalizedYRange.min,
      resolvedOverlaySeries,
      screenToData,
      xSnapStep,
      ySnapStep,
    ],
  );

  const handlePointPointerDown = React.useCallback(
    (curveType: 'main' | 'overlay', overlayIndex: number | null, index: number, editable: boolean) => (event: React.PointerEvent<SVGCircleElement>) => {
      const count = curveType === 'main'
        ? sortedPoints.length
        : (overlayIndex === null ? 0 : sortedOverlayPoints[overlayIndex]?.length ?? 0);

      if (!isDraggable(index, count, curveType, overlayIndex, editable)) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      activeAnchorRef.current = {
        type: curveType,
        curveIndex: overlayIndex,
        anchorIndex: index,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [isDraggable, sortedOverlayPoints, sortedPoints.length],
  );

  React.useEffect(() => {
    const onPointerMove = (event: PointerEvent): void => {
      const activeAnchor = activeAnchorRef.current;
      if (!activeAnchor) {
        return;
      }
      updateAnchor(activeAnchor.type, activeAnchor.anchorIndex, activeAnchor.curveIndex, event.clientX, event.clientY);
    };

    const onPointerUp = (): void => {
      activeAnchorRef.current = null;
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

  const mainCurveStyle = getLineStyle(0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width, ...style }} className={className}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {allowAnchorCountChange ? (
          <>
            <button type="button" onClick={addAnchor} aria-label="Add anchor">
              +
            </button>
            <button type="button" onClick={removeAnchor} disabled={anchors.length <= 2} aria-label="Remove anchor">
              -
            </button>
          </>
        ) : null}
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
            <text
              x={inner.paddingLeft - 18}
              y={yToScreen(mark.value) + 3}
              textAnchor="end"
              fontSize={10}
              fill="#334155"
            >
              {mark.label}
            </text>
          </g>
        ))}
        {anchorYMarks.map((mark) => (
          <g key={`anchor-y-mark-${mark.value}-${mark.label}`}>
            <text
              x={inner.paddingLeft - 18}
              y={yToScreen(mark.value) + 3}
              textAnchor="end"
              fontSize={10}
              fill="#0f172a"
            >
              {mark.label}
            </text>
          </g>
        ))}
        <polyline
          fill="none"
          stroke={mainCurveStyle.lineColor}
          strokeWidth={mainCurveStyle.lineWidth}
          strokeDasharray={mainCurveStyle.lineDashArray}
          points={pathPoints}
        />
        {sortedPoints.map((anchor, index) => {
          const cursor = getAnchorCursor(index, sortedPoints.length, 'main', null, true);
          return (
            <g key={`${index}`}>
              <circle
                cx={xToScreen(anchor.x)}
                cy={yToScreen(anchor.y)}
                r={5}
                fill={mainCurveStyle.anchorPointColor}
                stroke="#fff"
                strokeWidth={1.5}
                onPointerDown={handlePointPointerDown('main', null, index, true)}
                style={{ cursor }}
              />
            </g>
          );
        })}
        {overlayPathPoints.map((points, overlayIndex) => {
          const overlayCurve = resolvedOverlaySeries[overlayIndex];
          if (!overlayCurve) {
            return null;
          }

          const curvePoints = sortedOverlayPoints[overlayIndex];
          if (!curvePoints) {
            return null;
          }

          return (
            <g key={`overlay-${overlayIndex}`}>
              <polyline
                fill="none"
                stroke={overlayCurve.lineColor}
                strokeWidth={overlayCurve.lineWidth}
                strokeDasharray={overlayCurve.lineDashArray}
                points={points}
              />
              {curvePoints.map((anchor, pointIndex) => {
                const cursor = getAnchorCursor(pointIndex, curvePoints.length, 'overlay', overlayIndex, overlayCurve.editable);
                return (
                  <circle
                    key={`overlay-${overlayIndex}-anchor-${pointIndex}`}
                    cx={xToScreen(anchor.x)}
                    cy={yToScreen(anchor.y)}
                    r={5}
                    fill={overlayCurve.anchorPointColor}
                    stroke="#fff"
                    strokeWidth={1.5}
                    onPointerDown={handlePointPointerDown('overlay', overlayIndex, pointIndex, overlayCurve.editable)}
                    style={{ cursor }}
                  />
                );
              })}
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
