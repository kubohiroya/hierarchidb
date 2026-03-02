import { Box } from '@mui/material';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';
import type { TaskProgressData } from './useTaskProgressBarState';
import type { TaskProgressSegment } from './useTaskProgressBarComputation.js';

type TaskProgressBarViewProps = TaskProgressData;

const SEGMENT_OUT_RANGE_Y = 0.2;
const SEGMENT_OUT_RANGE_HEIGHT = 0.6;
const FLOW_BAND_ANIMATION_DURATION_MS = 1.6;
const RECT_HEIGHT = 20;

const isSegmentInViewport = (
  segmentStart: number,
  segmentEnd: number,
  viewportStart: number | null,
  viewportEnd: number | null,
) => (
  viewportStart !== null
  && viewportEnd !== null
  && segmentStart <= viewportEnd
  && segmentEnd >= viewportStart
);

const renderSegment = ({
  segmentStartX,
  keySuffix,
  segment,
  isInViewport,
  onActivateTaskSegment,
}: {
  segmentStartX: number;
  keySuffix: string;
  segment: TaskProgressSegment;
  isInViewport: boolean;
  onActivateTaskSegment: (segment: TaskProgressSegment) => void;
}) => {
  const width = segment.width;
  const title = segment.title || 'Task segment';

  const onActivate = (event?: ReactMouseEvent | ReactKeyboardEvent) => {
    event?.preventDefault();
    if (!segment.taskId) return;
    onActivateTaskSegment(segment);
  };

  const rect = (
    <rect
      x={segmentStartX}
      y={isInViewport ? 0 : SEGMENT_OUT_RANGE_Y}
      width={width}
      height={isInViewport ? 1 : SEGMENT_OUT_RANGE_HEIGHT}
      fill={segment.fill}
      fillOpacity={segment.fillOpacity}
    />
  );

  if (!segment.taskId) {
    return (
      <g key={`task-${keySuffix}`}>
        {rect}
        <title>{title}</title>
      </g>
    );
  }

  return (
    <a
      key={`task-${segment.taskId}`}
      href={`#task-${segment.taskId}`}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          onActivate(event);
        }
      }}
      aria-label={`Scroll to ${segment.stageId} task`}
      style={{ cursor: 'pointer' }}
    >
      {rect}
      <title>{title}</title>
    </a>
  );
};

export const TaskProgressBarView = ({
  viewWidth,
  segments,
  emptyColor,
  flowBandRange,
  flowBandClipId,
  flowBandWidth,
  showFlowBand,
  viewportStartGlobal,
  viewportEndGlobal,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onActivateTaskSegment,
}: TaskProgressBarViewProps) => {
  const maybeFlowBand = (() => {
    if (!showFlowBand || !flowBandRange) return null;
    return (
      <rect
        x={-flowBandWidth}
        y={0}
        width={flowBandWidth}
        height={1}
        fill="#ffffff80"
        clipPath={`url(#task-progress-flow-${flowBandClipId})`}
      >
        <animate
          attributeName="x"
          from={-flowBandWidth}
          to={viewWidth}
          dur={`${FLOW_BAND_ANIMATION_DURATION_MS}s`}
          repeatCount="indefinite"
        />
      </rect>
    );
  })();

  return (
    <Box
      sx={{
        width: '100%',
        height: RECT_HEIGHT,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <svg
        width="100%"
        height={RECT_HEIGHT}
        viewBox={`0 0 ${viewWidth} 1`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ touchAction: 'none' }}
      >
        <title>Task progress bar</title>
        {flowBandRange ? (
          <defs>
            <clipPath id={`task-progress-flow-${flowBandClipId}`}>
              <rect
                x={flowBandRange.x}
                y={0}
                width={flowBandRange.width}
                height={1}
              />
            </clipPath>
          </defs>
        ) : null}
        {segments.length > 0 ? (() => {
          let offset = 0;
          return segments.map((segment: TaskProgressSegment, index: number) => {
            const segmentStart = offset;
            const segmentEnd = segmentStart + segment.width - 1;
            const inViewport = isSegmentInViewport(
              segmentStart,
              segmentEnd,
              viewportStartGlobal,
              viewportEndGlobal,
            );
            const node = renderSegment({
              segmentStartX: segmentStart,
              keySuffix: `${index}-${segment.width}-${segment.taskId ?? 'empty'}`,
              segment,
              isInViewport: inViewport,
              onActivateTaskSegment,
            });
            offset += segment.width;
            return node;
          });
        })() : (
          <rect
            key="task-empty"
            x={0}
            y={SEGMENT_OUT_RANGE_Y}
            width={1}
            height={SEGMENT_OUT_RANGE_HEIGHT}
            fill={emptyColor}
          />
        )}
        {showFlowBand && flowBandRange ? maybeFlowBand : null}
      </svg>
    </Box>
  );
};
