import React from 'react';

import { formatAnchorValueLabel, useToneCurveEditor } from './useToneCurveEditor';

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
  horizontalZoom?: boolean;
  verticalZoom?: boolean;
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

export function ToneCurveEditor(props: ToneCurveEditorProps): React.JSX.Element {
  const {
    width,
    height,
    className,
    style,
  } = props;

  const {
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
  } = useToneCurveEditor(props);

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, width, ...style }}
      className={className}
    >
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
        style={{
          border: '1px solid #d0d7de',
          borderRadius: 4,
          touchAction: 'none',
          backgroundColor: '#ffffff',
          cursor: isPanning ? 'grabbing' : 'grab',
        }}
        onPointerDown={handleBackgroundPointerDown}
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
            <g key={`${String(index)}`}>
              <circle
                cx={xToScreen(anchor.x)}
                cy={yToScreen(anchor.y)}
                r={5}
                fill={mainCurveStyle.anchorPointColor}
                stroke="#fff"
                strokeWidth={1.5}
                onPointerDown={handlePointPointerDown('main', null, index, true)}
                onPointerEnter={handlePointPointerEnter(anchor)}
                onPointerMove={handlePointPointerMove(anchor)}
                onPointerLeave={hideDragPointerLabel}
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
            <g key={`overlay-${String(overlayIndex)}`}>
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
                    key={`overlay-${overlayIndex}-anchor-${String(pointIndex)}`}
                    cx={xToScreen(anchor.x)}
                    cy={yToScreen(anchor.y)}
                    r={5}
                    fill={overlayCurve.anchorPointColor}
                    stroke="#fff"
                    strokeWidth={1.5}
                    onPointerDown={handlePointPointerDown('overlay', overlayIndex, pointIndex, overlayCurve.editable)}
                    onPointerEnter={handlePointPointerEnter(anchor)}
                    onPointerMove={handlePointPointerMove(anchor)}
                    onPointerLeave={hideDragPointerLabel}
                    style={{ cursor }}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      {dragPointerLabel && (
        <div
          style={{
            position: 'absolute',
            left: `${dragPointerLabel.x}px`,
            top: `${dragPointerLabel.y}px`,
            pointerEvents: 'none',
            padding: '4px 8px',
            background: 'rgba(15, 23, 42, 0.88)',
            color: '#fff',
            borderRadius: 4,
            fontSize: 12,
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            zIndex: 3,
          }}
        >
          {`(${formatAnchorValueLabel(dragPointerLabel.dataX)}, ${formatAnchorValueLabel(dragPointerLabel.dataY)})`}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
        <span>{`x: [${normalizedXRange.min}, ${normalizedXRange.max}]`}</span>
        <span>{`y: [${normalizedYRange.min}, ${normalizedYRange.max}]`}</span>
      </div>
    </div>
  );
}
