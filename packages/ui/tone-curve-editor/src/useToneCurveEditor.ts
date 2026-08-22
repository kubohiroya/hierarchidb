import React from 'react';
import { formatAnchorValueLabel } from './formatAnchorValueLabel.js';
import type {
  ToneCurveAnchor,
  ToneCurveAxisMark,
  ToneCurveEditorProps,
  ToneCurveOverlaySeries,
} from './ToneCurveEditor';

const ANCHOR_EPSILON = 1e-6;
const DEFAULT_LINE_COLOR = '#0b5ed7';
const DEFAULT_SECONDARY_LINE_COLOR = '#ef4444';
const DEFAULT_SECONDARY_LINE_DASH = '6 4';
const DEFAULT_STROKE_WIDTH = 2;
const ZOOM_RATIO_STEP = 0.12;
const MIN_RANGE_SPAN = 1e-6;
const ARE_ANCHORS_EQUAL_EPSILON = 1e-9;

interface AxisRange {
  min: number;
  max: number;
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

const toAxisRange = (
  value: [number, number],
  fallbackMin: number,
  fallbackMax: number
): AxisRange => {
  const [a, b] = value;
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { min: fallbackMin, max: fallbackMax };
  }

  if (a === b) {
    return { min: Math.min(a, fallbackMin), max: Math.max(a, fallbackMax) };
  }

  return a < b ? { min: a, max: b } : { min: b, max: a };
};

const clampRangeInBase = (value: [number, number] | undefined, baseRange: AxisRange): AxisRange => {
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

const normalizeAnchorValue = (value: number): number => {
  if (!Number.isFinite(value)) {
    return value;
  }

  return Number.parseFloat(value.toFixed(10));
};

const anchorValueForSignature = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '';
  }

  return normalizeAnchorValue(value).toString();
};

const snapValue = (value: number, step: number | undefined): number => {
  const resolvedStep = step ?? 0;
  if (!Number.isFinite(resolvedStep) || resolvedStep === 0) {
    return normalizeAnchorValue(value);
  }

  return normalizeAnchorValue(Math.round(value / resolvedStep) * resolvedStep);
};

const normalizeAxisMarks = (
  marks: Array<ToneCurveAxisMark> | undefined,
  range: AxisRange
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
  length: number
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

const areAnchorsEqual = (
  left: ReadonlyArray<ToneCurveAnchor>,
  right: ReadonlyArray<ToneCurveAnchor>
): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i += 1) {
    const leftX = normalizeAnchorValue(left[i]?.x ?? 0);
    const rightX = normalizeAnchorValue(right[i]?.x ?? 0);
    const leftY = normalizeAnchorValue(left[i]?.y ?? 0);
    const rightY = normalizeAnchorValue(right[i]?.y ?? 0);
    if (
      Math.abs(leftX - rightX) > ARE_ANCHORS_EQUAL_EPSILON ||
      Math.abs(leftY - rightY) > ARE_ANCHORS_EQUAL_EPSILON
    ) {
      return false;
    }
  }
  return true;
};

export interface UseToneCurveEditorResult {
  svgRef: React.RefObject<SVGSVGElement | null>;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  anchors: ToneCurveAnchor[];
  allowAnchorCountChange: boolean;
  addAnchor: () => void;
  removeAnchor: () => void;
  isPanning: boolean;
  handleBackgroundPointerDown: (event: React.PointerEvent<SVGSVGElement>) => void;
  inner: {
    paddingLeft: number;
    paddingRight: number;
    paddingTop: number;
    paddingBottom: number;
    width: number;
    height: number;
  };
  normalizedXMarks: ToneCurveAxisMark[];
  anchorYMarks: Array<{ value: number; label: string }>;
  xToScreen: (x: number) => number;
  yToScreen: (y: number) => number;
  mainCurveStyle: {
    lineColor: string;
    anchorPointColor: string;
    lineWidth: number;
    lineDashArray?: string;
  };
  pathPoints: string;
  sortedPoints: ToneCurveAnchor[];
  overlayPathPoints: string[];
  resolvedOverlaySeries: ResolvedOverlaySeries[];
  sortedOverlayPoints: ToneCurveAnchor[][];
  getAnchorCursor: (
    index: number,
    count: number,
    type: 'main' | 'overlay',
    overlayIndex: number | null,
    editable: boolean
  ) => string;
  handlePointPointerDown: (
    curveType: 'main' | 'overlay',
    overlayIndex: number | null,
    index: number,
    editable: boolean
  ) => (event: React.PointerEvent<SVGCircleElement>) => void;
  handlePointPointerEnter: (
    anchor: ToneCurveAnchor | undefined
  ) => (event: React.PointerEvent<SVGCircleElement>) => void;
  handlePointPointerMove: (
    anchor: ToneCurveAnchor | undefined
  ) => (event: React.PointerEvent<SVGCircleElement>) => void;
  hideDragPointerLabel: () => void;
  dragPointerLabel: {
    x: number;
    y: number;
    dataX: number;
    dataY: number;
  } | null;
  normalizedXRange: AxisRange;
  normalizedYRange: AxisRange;
}

export const useToneCurveEditor = ({
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
  horizontalZoom = true,
  verticalZoom = true,
}: ToneCurveEditorProps): UseToneCurveEditorResult => {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const dragPointerScreenRef = React.useRef<{ x: number; y: number } | null>(null);
  const activeAnchorRef = React.useRef<{
    type: 'main' | 'overlay';
    curveIndex: number | null;
    anchorIndex: number;
  } | null>(null);
  const activePanRef = React.useRef<{
    startX: number;
    startY: number;
    startXRange: AxisRange;
    startYRange: AxisRange;
  } | null>(null);
  const activeDragSessionRef = React.useRef(0);
  const [isPanning, setIsPanning] = React.useState(false);
  const [dragPointerLabel, setDragPointerLabel] = React.useState<{
    x: number;
    y: number;
    dataX: number;
    dataY: number;
  } | null>(null);

  const getLineStyle = React.useCallback(
    (
      curveIndex: number
    ): {
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
      const defaultDashArray = isPrimary
        ? undefined
        : curveIndex === 1
          ? DEFAULT_SECONDARY_LINE_DASH
          : undefined;
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
    [anchorPointColor, lineColor, lineStyles]
  );

  const baseXRange = React.useMemo(() => toAxisRange(xRange, 0, 1), [xRange]);
  const baseYRange = React.useMemo(() => toAxisRange(yRange, 0, 1), [yRange]);

  const normalizedXRange = React.useMemo(
    () => clampRangeInBase(xEndpointRange, baseXRange),
    [baseXRange, xEndpointRange]
  );
  const normalizedYRange = React.useMemo(
    () => clampRangeInBase(yEndpointRange, baseYRange),
    [baseYRange, yEndpointRange]
  );

  const [viewXRange, setViewXRange] = React.useState<AxisRange>(normalizedXRange);
  const [viewYRange, setViewYRange] = React.useState<AxisRange>(normalizedYRange);

  React.useEffect(() => {
    setViewXRange(normalizedXRange);
  }, [normalizedXRange.max, normalizedXRange.min]);

  React.useEffect(() => {
    setViewYRange(normalizedYRange);
  }, [normalizedYRange.max, normalizedYRange.min]);

  const normalizedXMarks = React.useMemo(
    () => normalizeAxisMarks(xMarks, normalizedXRange),
    [normalizedXRange, xMarks]
  );
  const normalizedYMarks = React.useMemo(
    () => normalizeAxisMarks(yMarks, normalizedYRange),
    [normalizedYRange, yMarks]
  );

  const resolveTargetAnchorCount = React.useCallback(
    (
      xValues: Array<number | undefined> | undefined,
      yValues: Array<number | undefined> | undefined
    ): number => Math.max(2, xValues?.length ?? 0, yValues?.length ?? 0),
    []
  );
  const resolvedOverlaySeriesInput = React.useMemo(
    () => (Array.isArray(overlaySeries) ? overlaySeries : []),
    [overlaySeries]
  );
  const normalizeFixedValueArray = React.useCallback(
    (
      values: ReadonlyArray<number | undefined> | Array<number | undefined> | undefined
    ): Array<number | undefined> => (Array.isArray(values) ? values : []),
    []
  );
  const normalizeAnchorArray = React.useCallback(
    (points: ReadonlyArray<ToneCurveAnchor> | ToneCurveAnchor[] | undefined): ToneCurveAnchor[] =>
      Array.isArray(points) ? [...points] : [],
    []
  );

  const targetAnchorCount = React.useMemo(
    () => resolveTargetAnchorCount(xFixedValues, yFixedValues),
    [resolveTargetAnchorCount, xFixedValues, yFixedValues]
  );

  const fixedHorizontalValues = React.useMemo(
    () => normalizeAxisValues(xFixedValues, targetAnchorCount),
    [xFixedValues, targetAnchorCount]
  );
  const fixedVerticalValues = React.useMemo(
    () => normalizeAxisValues(yFixedValues, targetAnchorCount),
    [yFixedValues, targetAnchorCount]
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
      sourceAnchors: ReadonlyArray<ToneCurveAnchor> | undefined,
      fixedXValues: Array<number | undefined> = [],
      fixedYValues: Array<number | undefined> = []
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
        const externalAnchor = sourceAnchors?.[i];
        const externalAnchorX =
          externalAnchor && Number.isFinite(externalAnchor.x) ? externalAnchor.x : undefined;
        const externalAnchorY =
          externalAnchor && Number.isFinite(externalAnchor.y) ? externalAnchor.y : undefined;
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
          x:
            fixedX === undefined
              ? snapValue(externalAnchorX ?? defaultX, xSnapStep)
              : clamp(fixedX, normalizedXRange.min, normalizedXRange.max),
          y:
            fixedY === undefined
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
    ]
  );

  const initialAnchors = React.useMemo(
    () => createAnchorsFromInputs(externalAnchors, fixedHorizontalValues, fixedVerticalValues),
    [createAnchorsFromInputs, externalAnchors, fixedHorizontalValues, fixedVerticalValues]
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
    [width, height]
  );

  const xToScreen = React.useCallback(
    (x: number) => {
      const range = viewXRange.max - viewXRange.min;
      if (range === 0) {
        return inner.paddingLeft;
      }
      const ratio = (x - viewXRange.min) / range;
      return inner.paddingLeft + ratio * inner.width;
    },
    [inner, viewXRange.max, viewXRange.min]
  );

  const yToScreen = React.useCallback(
    (y: number) => {
      const range = viewYRange.max - viewYRange.min;
      if (range === 0) {
        return inner.paddingTop;
      }
      const ratio = (y - viewYRange.min) / range;
      return inner.paddingTop + (1 - ratio) * inner.height;
    },
    [inner, viewYRange.max, viewYRange.min]
  );

  const screenToData = React.useCallback(
    (clientX: number, clientY: number) => {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) {
        return null;
      }

      const x =
        viewXRange.min +
        ((clientX - svgRect.left - inner.paddingLeft) / inner.width) *
          (viewXRange.max - viewXRange.min);
      const y =
        viewYRange.max -
        ((clientY - svgRect.top - inner.paddingTop) / inner.height) *
          (viewYRange.max - viewYRange.min);
      return { x, y };
    },
    [inner, viewXRange.max, viewXRange.min, viewYRange.max, viewYRange.min]
  );

  const normalizeAnchors = React.useCallback(
    (
      values: ToneCurveAnchor[],
      fixedXValues: Array<number | undefined>,
      fixedYValues: Array<number | undefined>,
      fallbackAnchors: ToneCurveAnchor[] = initialAnchors
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
        const clampedFixedX =
          fixedX === undefined
            ? undefined
            : clamp(fixedX, normalizedXRange.min, normalizedXRange.max);
        const clampedFixedY =
          fixedY === undefined
            ? undefined
            : clamp(fixedY, normalizedYRange.min, normalizedYRange.max);

        return {
          x:
            fixedX === undefined
              ? snapValue(anchor.x, xSnapStep)
              : (clampedFixedX ?? normalizedXRange.min),
          y:
            fixedY === undefined
              ? snapValue(anchor.y, ySnapStep)
              : (clampedFixedY ?? normalizedYRange.min),
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
          const normalizedFixedX =
            fixedX === undefined
              ? undefined
              : clamp(fixedX, normalizedXRange.min, normalizedXRange.max);
          const normalizedFixedY =
            fixedY === undefined
              ? undefined
              : clamp(fixedY, normalizedYRange.min, normalizedYRange.max);
          const isFirst = index === 0;
          const isLast = index === count - 1;

          const nextX = isFirst
            ? normalizedFixedX === undefined
              ? normalizedXRange.min
              : normalizedFixedX
            : isLast
              ? normalizedFixedX === undefined
                ? normalizedXRange.max
                : normalizedFixedX
              : Math.max(anchor.x, (list[index - 1]?.x ?? normalizedXRange.min) + ANCHOR_EPSILON);

          return {
            x: fixedX === undefined ? snapValue(nextX, xSnapStep) : nextX,
            y:
              fixedY === undefined
                ? snapValue(anchor.y, ySnapStep)
                : (normalizedFixedY ?? normalizedYRange.min),
          };
        });
    },
    [
      clamp,
      initialAnchors,
      normalizedXRange.max,
      normalizedXRange.min,
      normalizedYRange.max,
      normalizedYRange.min,
      xSnapStep,
      ySnapStep,
    ]
  );

  const [anchors, setAnchors] = React.useState<ToneCurveAnchor[]>(initialAnchors);
  const previousAnchorsRef = React.useRef<ToneCurveAnchor[]>(initialAnchors);
  const pendingMainChangeRef = React.useRef<{
    anchors: ToneCurveAnchor[];
    dragSession: number;
  } | null>(null);
  const lastPointerPositionRef = React.useRef<{ x: number; y: number } | null>(null);
  const resolvedOverlaySeries = React.useMemo<ResolvedOverlaySeries[]>(
    () =>
      resolvedOverlaySeriesInput.map((overlaySeriesItem, overlayIndex): ResolvedOverlaySeries => {
        const safeSeries: ToneCurveOverlaySeries = overlaySeriesItem ?? {};
        const safeCount = resolveTargetAnchorCount(
          normalizeFixedValueArray(safeSeries.xFixedValues),
          normalizeFixedValueArray(safeSeries.yFixedValues)
        );
        const resolvedStyle = getLineStyle(overlayIndex + 1);
        const resolvedLineColor = safeSeries.lineColor ?? resolvedStyle.lineColor;
        const resolvedAnchorPointColor =
          safeSeries.anchorPointColor ?? resolvedLineColor ?? resolvedStyle.anchorPointColor;

        return {
          anchors: safeSeries.anchors ?? [],
          xFixedValues: normalizeAxisValues(
            normalizeFixedValueArray(safeSeries.xFixedValues),
            safeCount
          ),
          yFixedValues: normalizeAxisValues(
            normalizeFixedValueArray(safeSeries.yFixedValues),
            safeCount
          ),
          allowAnchorCountChange: safeSeries.allowAnchorCountChange ?? false,
          lineColor: resolvedLineColor,
          anchorPointColor: resolvedAnchorPointColor,
          lineWidth: safeSeries.lineWidth ?? resolvedStyle.lineWidth,
          lineDashArray: safeSeries.lineDashArray ?? resolvedStyle.lineDashArray,
          editable: safeSeries.editable ?? true,
          onChange: safeSeries.onChange,
        };
      }),
    [normalizeFixedValueArray, getLineStyle, resolvedOverlaySeriesInput, resolveTargetAnchorCount]
  );
  const [overlayAnchors, setOverlayAnchors] = React.useState<ToneCurveAnchor[][]>(() =>
    resolvedOverlaySeries.map((series) =>
      createAnchorsFromInputs(series.anchors, series.xFixedValues, series.yFixedValues)
    )
  );
  const syncedOverlaySignatureRef = React.useRef<string>('');
  const previousOverlayAnchorsRef = React.useRef<ToneCurveAnchor[][]>([]);
  const pendingOverlayChangeRef = React.useRef<{
    anchors: ToneCurveAnchor[];
    overlayIndex: number;
    onChange?: (anchors: ReadonlyArray<ToneCurveAnchor>) => void;
    dragSession: number;
  } | null>(null);

  const overlaySignature = React.useMemo(
    () =>
      resolvedOverlaySeries
        .map((series, index) => {
          const style = getLineStyle(index + 1);
          const anchorsSignature =
            series.anchors
              ?.map(
                (anchor) =>
                  `${Number.isFinite(anchor.x) ? anchorValueForSignature(anchor.x) : ''}:${Number.isFinite(anchor.y) ? anchorValueForSignature(anchor.y) : ''}`
              )
              .join('|') ?? '';
          const xFixedValueCount = series.xFixedValues.length;
          const yFixedValueCount = series.yFixedValues.length;

          return `${xFixedValueCount}-${yFixedValueCount}-${series.lineColor ?? style.lineColor}-${series.anchorPointColor ?? style.anchorPointColor}-${series.lineWidth}-${series.lineDashArray ?? style.lineDashArray ?? ''}-${series.editable}-${anchorsSignature}`;
        })
        .join('||'),
    [resolvedOverlaySeries, getLineStyle]
  );
  React.useEffect(() => {
    if (activeAnchorRef.current) {
      return;
    }

    pendingMainChangeRef.current = null;
    pendingOverlayChangeRef.current = null;
    lastPointerPositionRef.current = null;
    dragPointerScreenRef.current = null;

    if (overlaySignature === syncedOverlaySignatureRef.current) {
      return;
    }

    syncedOverlaySignatureRef.current = overlaySignature;
    const nextOverlayAnchors = resolvedOverlaySeries.map((series) =>
      createAnchorsFromInputs(series.anchors, series.xFixedValues, series.yFixedValues)
    );
    setOverlayAnchors(nextOverlayAnchors);
    previousOverlayAnchorsRef.current = nextOverlayAnchors;
  }, [createAnchorsFromInputs, overlaySignature, resolvedOverlaySeries]);

  const fixedXSignature = React.useMemo(
    () =>
      fixedHorizontalValues.map((value) => (Number.isFinite(value) ? `${value}` : '')).join('|'),
    [fixedHorizontalValues]
  );
  const externalAnchorsSignature = React.useMemo(
    () =>
      externalAnchors
        ?.map(
          (anchor) =>
            `${Number.isFinite(anchor.x) ? anchorValueForSignature(anchor.x) : ''}:${Number.isFinite(anchor.y) ? anchorValueForSignature(anchor.y) : ''}`
        )
        .join('|') ?? '',
    [externalAnchors]
  );
  const syncedFixedSignatureRef = React.useRef<string>(fixedXSignature);
  const syncedAnchorsSignatureRef = React.useRef<string>(externalAnchorsSignature);
  const syncedAnchorCountRef = React.useRef<number>(initialAnchors.length);

  React.useEffect(() => {
    if (activeAnchorRef.current) {
      return;
    }

    pendingMainChangeRef.current = null;
    pendingOverlayChangeRef.current = null;
    lastPointerPositionRef.current = null;
    dragPointerScreenRef.current = null;
    setDragPointerLabel(null);

    if (
      fixedXSignature === syncedFixedSignatureRef.current &&
      externalAnchorsSignature === syncedAnchorsSignatureRef.current &&
      syncedAnchorCountRef.current === initialAnchors.length
    ) {
      return;
    }

    previousAnchorsRef.current = initialAnchors;
    syncedFixedSignatureRef.current = fixedXSignature;
    syncedAnchorsSignatureRef.current = externalAnchorsSignature;
    syncedAnchorCountRef.current = initialAnchors.length;
    setAnchors(initialAnchors);
  }, [externalAnchorsSignature, initialAnchors, fixedXSignature]);

  const emitMainAnchorsChange = React.useCallback(
    (nextAnchors: ToneCurveAnchor[]) => {
      if (!onChange) {
        return;
      }
      if (areAnchorsEqual(previousAnchorsRef.current, nextAnchors)) {
        return;
      }
      previousAnchorsRef.current = nextAnchors;
      onChange(nextAnchors);
    },
    [onChange]
  );

  const flushPendingMainChange = React.useCallback(
    (dragSession?: number) => {
      if (!pendingMainChangeRef.current) {
        return;
      }
      if (dragSession !== undefined && pendingMainChangeRef.current.dragSession !== dragSession) {
        pendingMainChangeRef.current = null;
        return;
      }

      const { anchors: nextAnchors } = pendingMainChangeRef.current;
      if (areAnchorsEqual(previousAnchorsRef.current, nextAnchors)) {
        pendingMainChangeRef.current = null;
        return;
      }

      pendingMainChangeRef.current = null;
      emitMainAnchorsChange(nextAnchors);
    },
    [emitMainAnchorsChange]
  );

  const emitOverlayAnchorsChange = React.useCallback(
    (
      overlayIndex: number,
      nextAnchors: ToneCurveAnchor[],
      onChange?: (anchors: ReadonlyArray<ToneCurveAnchor>) => void
    ) => {
      if (!onChange) {
        return;
      }

      const previousAnchors = previousOverlayAnchorsRef.current[overlayIndex];
      if (previousAnchors && areAnchorsEqual(previousAnchors, nextAnchors)) {
        return;
      }

      const nextPreviousAnchors = [...previousOverlayAnchorsRef.current];
      nextPreviousAnchors[overlayIndex] = nextAnchors;
      previousOverlayAnchorsRef.current = nextPreviousAnchors;
      onChange(nextAnchors);
    },
    []
  );

  const flushPendingOverlayChange = React.useCallback(
    (dragSession?: number): void => {
      const pending = pendingOverlayChangeRef.current;
      if (!pending) {
        return;
      }
      if (dragSession !== undefined && pending.dragSession !== dragSession) {
        pendingOverlayChangeRef.current = null;
        return;
      }
      pendingOverlayChangeRef.current = null;

      const { anchors: nextAnchors, onChange: currentOverlay, overlayIndex } = pending;
      if (typeof overlayIndex !== 'number') {
        return;
      }
      if (currentOverlay === undefined) {
        return;
      }
      emitOverlayAnchorsChange(overlayIndex, nextAnchors, currentOverlay);
    },
    [emitOverlayAnchorsChange]
  );

  const sortedPoints = React.useMemo(() => [...anchors].sort((a, b) => a.x - b.x), [anchors]);

  const sortedOverlayPoints = React.useMemo(
    () =>
      (Array.isArray(overlayAnchors) ? overlayAnchors : []).map((curveAnchors) =>
        normalizeAnchorArray(curveAnchors).sort((a, b) => a.x - b.x)
      ),
    [overlayAnchors, normalizeAnchorArray]
  );

  const pathPoints = React.useMemo(
    () => sortedPoints.map((anchor) => `${xToScreen(anchor.x)},${yToScreen(anchor.y)}`).join(' '),
    [sortedPoints, xToScreen, yToScreen]
  );
  const overlayPathPoints = React.useMemo(
    () =>
      sortedOverlayPoints.map((points) =>
        normalizeAnchorArray(points)
          .map((anchor) => `${xToScreen(anchor.x)},${yToScreen(anchor.y)}`)
          .join(' ')
      ),
    [normalizeAnchorArray, sortedOverlayPoints, xToScreen, yToScreen]
  );
  const anchorYMarks = React.useMemo(() => {
    const dedupeEpsilon = 1e-9;
    const labelFontSize = 10;

    const mergedCandidates = new Map<
      string,
      { value: number; label: string; forceDisplay: boolean }
    >();

    const mergedToKey = (value: number): string => value.toFixed(10);
    const addCandidate = (
      value: number,
      label: string,
      options?: { forceDisplay?: boolean }
    ): void => {
      if (!Number.isFinite(value)) {
        return;
      }

      const key = mergedToKey(value);
      const current = mergedCandidates.get(key);
      if (current === undefined) {
        mergedCandidates.set(key, { value, label, forceDisplay: options?.forceDisplay ?? false });
        return;
      }

      if (options?.forceDisplay === true && !current.forceDisplay) {
        mergedCandidates.set(key, { value, label: current.label, forceDisplay: true });
      }
    };

    normalizedYMarks.forEach((mark) => {
      addCandidate(mark.value, mark.label);
    });

    anchors.forEach((anchor) => {
      addCandidate(anchor.y, formatAnchorValueLabel(anchor.y));
    });

    overlayAnchors
      .flatMap((curveAnchors) => curveAnchors.map((anchor) => anchor.y))
      .forEach((value) => {
        addCandidate(value, formatAnchorValueLabel(value));
      });

    addCandidate(normalizedYRange.min, formatAnchorValueLabel(normalizedYRange.min), {
      forceDisplay: true,
    });
    addCandidate(normalizedYRange.max, formatAnchorValueLabel(normalizedYRange.max), {
      forceDisplay: true,
    });
    addCandidate(viewYRange.min, formatAnchorValueLabel(viewYRange.min), { forceDisplay: true });
    addCandidate(viewYRange.max, formatAnchorValueLabel(viewYRange.max), { forceDisplay: true });

    const sortedUniqueValues = Array.from(mergedCandidates.values()).sort(
      (left, right) => left.value - right.value
    );

    const dedupedByValue = [];
    for (let index = 0; index < sortedUniqueValues.length; index += 1) {
      const current = sortedUniqueValues[index];
      if (!current) {
        continue;
      }
      const previous = dedupedByValue[dedupedByValue.length - 1];
      if (!previous || Math.abs(previous.value - current.value) > dedupeEpsilon) {
        dedupedByValue.push(current);
      }
    }

    const result: Array<{ value: number; label: string }> = [];
    let lastVisibleScreenY: number | null = null;

    dedupedByValue.forEach((item) => {
      const screenY = yToScreen(item.value);
      if (
        item.forceDisplay ||
        lastVisibleScreenY === null ||
        Math.abs(screenY - lastVisibleScreenY) > labelFontSize
      ) {
        result.push({
          value: item.value,
          label: item.label,
        });
        lastVisibleScreenY = screenY;
      }
    });

    return result;
  }, [
    anchors,
    overlayAnchors,
    normalizedYMarks,
    normalizedYRange.max,
    normalizedYRange.min,
    viewYRange.max,
    viewYRange.min,
    yToScreen,
  ]);

  const fixedXForCount = React.useCallback(
    (count: number): Array<number | undefined> => {
      const next = new Array<number | undefined>(count).fill(undefined);
      for (let i = 0; i < count; i += 1) {
        next[i] = i < fixedHorizontalValues.length ? fixedHorizontalValues[i] : undefined;
      }
      return next;
    },
    [fixedHorizontalValues]
  );

  const fixedYForCount = React.useCallback(
    (count: number): Array<number | undefined> => {
      const next = new Array<number | undefined>(count).fill(undefined);
      for (let i = 0; i < count; i += 1) {
        next[i] = i < fixedVerticalValues.length ? fixedVerticalValues[i] : undefined;
      }
      return next;
    },
    [fixedVerticalValues]
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
    []
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
    []
  );

  const getAnchorCursor = React.useCallback(
    (
      index: number,
      count: number,
      type: 'main' | 'overlay',
      overlayIndex: number | null,
      editable: boolean
    ): string => {
      const overlayCurve = overlayIndex === null ? undefined : resolvedOverlaySeries[overlayIndex];
      const allowMovement = type === 'overlay' && overlayCurve ? overlayCurve.editable : editable;

      const fixedX =
        type === 'main'
          ? fixedXForCount(count)[index]
          : overlayCurve
            ? fixedXForOverlayCount(overlayCurve, count)[index]
            : undefined;
      const fixedY =
        type === 'main'
          ? fixedYForCount(count)[index]
          : overlayCurve
            ? fixedYForOverlayCount(overlayCurve, count)[index]
            : undefined;

      const canMoveX = fixedX === undefined ? allowMovement : false;
      const canMoveY = fixedY === undefined ? allowMovement : false;

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
    [
      fixedXForCount,
      fixedYForCount,
      fixedXForOverlayCount,
      fixedYForOverlayCount,
      resolvedOverlaySeries,
    ]
  );

  const isDraggable = React.useCallback(
    (
      index: number,
      count: number,
      type: 'main' | 'overlay',
      overlayIndex: number | null,
      editable: boolean
    ): boolean => {
      const overlayCurve = overlayIndex === null ? undefined : resolvedOverlaySeries[overlayIndex];
      const allowMovement = type === 'overlay' && overlayCurve ? overlayCurve.editable : editable;

      const fixedX =
        type === 'main'
          ? fixedXForCount(count)[index]
          : overlayCurve
            ? fixedXForOverlayCount(overlayCurve, count)[index]
            : undefined;
      const fixedY =
        type === 'main'
          ? fixedYForCount(count)[index]
          : overlayCurve
            ? fixedYForOverlayCount(overlayCurve, count)[index]
            : undefined;
      const canMoveX = fixedX === undefined ? allowMovement : false;
      const canMoveY = fixedY === undefined ? allowMovement : false;
      return canMoveX || canMoveY;
    },
    [
      fixedXForCount,
      fixedYForCount,
      fixedXForOverlayCount,
      fixedYForOverlayCount,
      resolvedOverlaySeries,
    ]
  );

  const addAnchor = React.useCallback(() => {
    const current = anchors;
    const list = [...current].sort((a, b) => a.x - b.x);
    if (list.length < 2) {
      return;
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
      return;
    }

    const nextX = (left.x + right.x) / 2;
    const nextY = (left.y + right.y) / 2;
    const next = [...list];
    next.splice(insertIndex + 1, 0, { x: nextX, y: nextY });
    const nextCount = next.length;
    const normalized = normalizeAnchors(next, fixedXForCount(nextCount), fixedYForCount(nextCount));
    setAnchors(normalized);
    emitMainAnchorsChange(normalized);
  }, [anchors, emitMainAnchorsChange, fixedXForCount, fixedYForCount, normalizeAnchors]);

  const removeAnchor = React.useCallback(() => {
    const current = anchors;
    if (current.length <= 2) {
      return;
    }

    const index = Math.floor(current.length / 2);
    if (index <= 0 || index >= current.length - 1) {
      return;
    }

    const next = [...current];
    next.splice(index, 1);
    const normalized = normalizeAnchors(
      next,
      fixedXForCount(next.length),
      fixedYForCount(next.length)
    );
    setAnchors(normalized);
    emitMainAnchorsChange(normalized);
  }, [anchors, emitMainAnchorsChange, fixedXForCount, fixedYForCount, normalizeAnchors]);

  const updateDragPointerLabelFromAnchor = React.useCallback(
    (anchor: ToneCurveAnchor | undefined, pointerPoint?: { x: number; y: number }): void => {
      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      if (!anchor || !wrapperRect) {
        setDragPointerLabel(null);
        return;
      }

      const pointer = pointerPoint ?? dragPointerScreenRef.current;
      const fallbackX = xToScreen(anchor.x) + wrapperRect.left;
      const fallbackY = yToScreen(anchor.y) + wrapperRect.top;

      setDragPointerLabel({
        x: (pointer?.x ?? fallbackX) - wrapperRect.left + 12,
        y: (pointer?.y ?? fallbackY) - wrapperRect.top - 22,
        dataX: anchor.x,
        dataY: anchor.y,
      });
    },
    [xToScreen, yToScreen]
  );

  const handlePointPointerEnter = React.useCallback(
    (anchor: ToneCurveAnchor | undefined) => (event: React.PointerEvent<SVGCircleElement>) => {
      if (!anchor || activeAnchorRef.current) {
        return;
      }
      updateDragPointerLabelFromAnchor(anchor, { x: event.clientX, y: event.clientY });
    },
    [updateDragPointerLabelFromAnchor]
  );

  const handlePointPointerMove = React.useCallback(
    (anchor: ToneCurveAnchor | undefined) => (event: React.PointerEvent<SVGCircleElement>) => {
      if (!anchor || activeAnchorRef.current) {
        return;
      }
      updateDragPointerLabelFromAnchor(anchor, { x: event.clientX, y: event.clientY });
    },
    [updateDragPointerLabelFromAnchor]
  );

  const hideDragPointerLabel = React.useCallback(() => {
    if (activeAnchorRef.current) {
      return;
    }
    setDragPointerLabel(null);
  }, []);

  const updateAnchor = React.useCallback(
    (
      curveType: 'main' | 'overlay',
      anchorIndex: number,
      overlayIndex: number | null,
      clientX: number,
      clientY: number
    ) => {
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
          const normalizedFixedX =
            fixedX === undefined
              ? undefined
              : clamp(fixedX, normalizedXRange.min, normalizedXRange.max);
          const normalizedFixedY =
            fixedY === undefined
              ? undefined
              : clamp(fixedY, normalizedYRange.min, normalizedYRange.max);

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

          const clampedX =
            fixedX === undefined
              ? clamp(point.x, minX, maxX)
              : (normalizedFixedX ?? normalizedXRange.min);

          const clampedY =
            fixedY === undefined
              ? clamp(point.y, normalizedYRange.min, normalizedYRange.max)
              : (normalizedFixedY ?? normalizedYRange.min);

          list[index] = {
            ...target,
            x: fixedX === undefined ? snapValue(clampedX, xSnapStep) : clampedX,
            y: fixedY === undefined ? snapValue(clampedY, ySnapStep) : clampedY,
          };
          updateDragPointerLabelFromAnchor(list[index]);
          pendingMainChangeRef.current = {
            anchors: list,
            dragSession: activeDragSessionRef.current,
          };

          return list;
        });
        return;
      }

      if (
        overlayIndex === null ||
        overlayIndex < 0 ||
        overlayIndex >= resolvedOverlaySeries.length
      ) {
        return;
      }

      const overlayCurve = resolvedOverlaySeries[overlayIndex];
      if (!overlayCurve) {
        return;
      }

      const fallbackAnchors = createAnchorsFromInputs(
        overlayCurve.anchors,
        overlayCurve.xFixedValues,
        overlayCurve.yFixedValues
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
        const canMoveX = fixedX === undefined && overlayCurve.editable;
        const canMoveY = fixedY === undefined && overlayCurve.editable;
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

        const clampedX = canMoveX
          ? clamp(point.x, minX, maxX)
          : clamp(fixedX ?? normalizedXRange.min, normalizedXRange.min, normalizedXRange.max);
        const clampedY = canMoveY
          ? clamp(point.y, normalizedYRange.min, normalizedYRange.max)
          : clamp(fixedY ?? normalizedYRange.min, normalizedYRange.min, normalizedYRange.max);

        const nextCurve = [...list];
        nextCurve[index] = {
          ...target,
          x: canMoveX ? snapValue(clampedX, xSnapStep) : clampedX,
          y: canMoveY ? snapValue(clampedY, ySnapStep) : clampedY,
        };

        const editableFixedX = fixedXForOverlayCount(overlayCurve, nextCurve.length);
        const editableFixedY = fixedYForOverlayCount(overlayCurve, nextCurve.length);

        const normalizedCurve = normalizeAnchors(
          nextCurve,
          editableFixedX,
          editableFixedY,
          fallbackAnchors
        );
        updateDragPointerLabelFromAnchor(normalizedCurve[index]);
        const nextAnchors = [...current];
        nextAnchors[overlayIndex] = normalizedCurve;
        pendingOverlayChangeRef.current = {
          anchors: normalizedCurve,
          overlayIndex,
          onChange: overlayCurve.onChange,
          dragSession: activeDragSessionRef.current,
        };
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
      updateDragPointerLabelFromAnchor,
      xSnapStep,
      ySnapStep,
    ]
  );

  const handlePointPointerDown = React.useCallback(
    (
      curveType: 'main' | 'overlay',
      overlayIndex: number | null,
      index: number,
      editable: boolean
    ) =>
      (event: React.PointerEvent<SVGCircleElement>) => {
        activeDragSessionRef.current += 1;
        pendingMainChangeRef.current = null;
        pendingOverlayChangeRef.current = null;

        const count =
          curveType === 'main'
            ? sortedPoints.length
            : overlayIndex === null
              ? 0
              : (sortedOverlayPoints[overlayIndex]?.length ?? 0);

        if (!isDraggable(index, count, curveType, overlayIndex, editable)) {
          event.preventDefault();
          return;
        }

        event.preventDefault();
        dragPointerScreenRef.current = {
          x: event.clientX,
          y: event.clientY,
        };
        activeAnchorRef.current = {
          type: curveType,
          curveIndex: overlayIndex,
          anchorIndex: index,
        };
        lastPointerPositionRef.current = {
          x: event.clientX,
          y: event.clientY,
        };
        const selectedAnchor =
          curveType === 'main'
            ? sortedPoints[index]
            : sortedOverlayPoints[overlayIndex ?? 0]?.[index];
        updateDragPointerLabelFromAnchor(selectedAnchor);
        event.currentTarget.setPointerCapture(event.pointerId);
      },
    [isDraggable, sortedOverlayPoints, sortedPoints, updateDragPointerLabelFromAnchor]
  );

  const translateRange = React.useCallback(
    (range: AxisRange, delta: number, bounds: AxisRange): AxisRange => {
      const span = range.max - range.min;
      const boundsSpan = bounds.max - bounds.min;

      if (span >= boundsSpan) {
        return { min: bounds.min, max: bounds.max };
      }

      let min = range.min + delta;
      let max = range.max + delta;

      if (min < bounds.min) {
        const adjust = bounds.min - min;
        min += adjust;
        max += adjust;
      }

      if (max > bounds.max) {
        const adjust = max - bounds.max;
        min -= adjust;
        max -= adjust;
      }

      return { min, max };
    },
    []
  );

  const handleBackgroundPointerDown = React.useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const target = event.target as Element | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'circle') {
        return;
      }
      if (activeAnchorRef.current) {
        return;
      }

      event.preventDefault();
      activePanRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        startXRange: viewXRange,
        startYRange: viewYRange,
      };
      setIsPanning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [viewXRange, viewYRange]
  );

  const clampRange = React.useCallback((range: AxisRange, baseRange: AxisRange): AxisRange => {
    const clampedMin = clampInOrder(range.min, baseRange.min, baseRange.max);
    const clampedMax = clampInOrder(range.max, baseRange.min, baseRange.max);
    if (clampedMax > clampedMin) {
      return { min: clampedMin, max: clampedMax };
    }

    return {
      min: Math.max(baseRange.min, Math.min(baseRange.max - MIN_RANGE_SPAN, clampedMin)),
      max: Math.min(baseRange.max, clampedMin + MIN_RANGE_SPAN),
    };
  }, []);

  const zoomRangeAroundPoint = React.useCallback(
    (range: AxisRange, center: number, scale: number, baseRange: AxisRange): AxisRange => {
      if (!Number.isFinite(scale) || scale <= 0) {
        return clampRange(range, baseRange);
      }

      const currentSpan = range.max - range.min;
      const safeSpan = currentSpan > MIN_RANGE_SPAN ? currentSpan : MIN_RANGE_SPAN;
      const nextSpan = safeSpan * scale;
      const clampedSpan = Math.max(nextSpan, MIN_RANGE_SPAN);
      const centerInRange = clampInOrder(center, range.min, range.max);

      let min = centerInRange - (centerInRange - range.min) * (clampedSpan / safeSpan);
      let max = centerInRange + (range.max - centerInRange) * (clampedSpan / safeSpan);

      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return clampRange(range, baseRange);
      }

      const clamped = clampRange({ min, max }, baseRange);
      if (clamped.max - clamped.min >= MIN_RANGE_SPAN) {
        return clamped;
      }

      return {
        min: centerInRange - clampedSpan / 2,
        max: centerInRange + clampedSpan / 2,
      };
    },
    [clampRange]
  );

  const handleWheel = React.useCallback(
    (event: WheelEvent) => {
      if (!svgRef.current) {
        return;
      }

      const point = screenToData(event.clientX, event.clientY);
      if (!point) {
        return;
      }

      const zoomRatio = 1 + ZOOM_RATIO_STEP * (event.deltaY > 0 ? 1 : -1);
      const scale = clampInOrder(zoomRatio, 0.2, 5);
      const canZoomHorizontally = horizontalZoom;
      const canZoomVertically = verticalZoom;

      if (!canZoomHorizontally && !canZoomVertically) {
        return;
      }

      event.preventDefault();

      if (canZoomHorizontally) {
        setViewXRange((current) => zoomRangeAroundPoint(current, point.x, scale, normalizedXRange));
      }

      if (canZoomVertically) {
        setViewYRange((current) => zoomRangeAroundPoint(current, point.y, scale, normalizedYRange));
      }
    },
    [
      horizontalZoom,
      normalizedXRange,
      normalizedYRange,
      screenToData,
      verticalZoom,
      zoomRangeAroundPoint,
    ]
  );

  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      svg.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  React.useEffect(() => {
    const onPointerMove = (event: PointerEvent): void => {
      const activeAnchor = activeAnchorRef.current;
      if (!activeAnchor) {
        const activePan = activePanRef.current;
        if (!activePan) {
          return;
        }

        const dx = event.clientX - activePan.startX;
        const dy = event.clientY - activePan.startY;

        const startXSpan = activePan.startXRange.max - activePan.startXRange.min;
        const startYSpan = activePan.startYRange.max - activePan.startYRange.min;
        const deltaX = inner.width === 0 ? 0 : -(dx / inner.width) * startXSpan;
        const deltaY = inner.height === 0 ? 0 : (dy / inner.height) * startYSpan;

        setViewXRange(translateRange(activePan.startXRange, deltaX, normalizedXRange));
        setViewYRange(translateRange(activePan.startYRange, deltaY, normalizedYRange));
        return;
      }
      dragPointerScreenRef.current = { x: event.clientX, y: event.clientY };
      lastPointerPositionRef.current = { x: event.clientX, y: event.clientY };
      updateAnchor(
        activeAnchor.type,
        activeAnchor.anchorIndex,
        activeAnchor.curveIndex,
        event.clientX,
        event.clientY
      );
    };

    const onPointerUp = (): void => {
      const activeAnchor = activeAnchorRef.current;
      if (activeAnchor) {
        const dragSession = activeDragSessionRef.current;
        const lastPointerPosition = lastPointerPositionRef.current;
        if (lastPointerPosition) {
          updateAnchor(
            activeAnchor.type,
            activeAnchor.anchorIndex,
            activeAnchor.curveIndex,
            lastPointerPosition.x,
            lastPointerPosition.y
          );
        }
        if (activeAnchor.type === 'main') {
          flushPendingMainChange(dragSession);
        } else {
          flushPendingOverlayChange(dragSession);
        }
      }
      setDragPointerLabel(null);
      activeAnchorRef.current = null;
      lastPointerPositionRef.current = null;
      activePanRef.current = null;
      setIsPanning(false);
    };

    const onPointerCancel = (): void => {
      const activeAnchor = activeAnchorRef.current;
      if (activeAnchor) {
        const dragSession = activeDragSessionRef.current;
        if (activeAnchor.type === 'main') {
          flushPendingMainChange(dragSession);
        } else {
          flushPendingOverlayChange(dragSession);
        }
      }
      activeAnchorRef.current = null;
      lastPointerPositionRef.current = null;
      setDragPointerLabel(null);
      activePanRef.current = null;
      setIsPanning(false);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [
    flushPendingMainChange,
    flushPendingOverlayChange,
    inner.height,
    inner.width,
    normalizedXRange,
    normalizedYRange,
    translateRange,
    updateAnchor,
  ]);

  const mainCurveStyle = getLineStyle(0);

  return {
    svgRef,
    wrapperRef,
    anchors,
    allowAnchorCountChange,
    addAnchor,
    removeAnchor,
    isPanning,
    handleBackgroundPointerDown,
    inner,
    normalizedXMarks,
    anchorYMarks,
    xToScreen,
    yToScreen,
    mainCurveStyle,
    pathPoints,
    sortedPoints,
    overlayPathPoints,
    resolvedOverlaySeries,
    sortedOverlayPoints,
    getAnchorCursor,
    handlePointPointerDown,
    handlePointPointerEnter,
    handlePointPointerMove,
    hideDragPointerLabel,
    dragPointerLabel,
    normalizedXRange,
    normalizedYRange,
  };
};

export type { ResolvedOverlaySeries };
