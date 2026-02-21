import { type PointerEvent, useId, useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import { useAtomValue } from 'jotai';
import { useBuildStageFilter } from '@hierarchidb/components';
import type { BuildStage } from '@hierarchidb/components/build-stage';
import { taskViewportRangeAtom } from '~/ui/atoms/shapeBuildProgressAtoms';
import type { TaskItemWithMetadata } from '~/ui/components/build-progress/taskItemCardList/types';
import type { TaskProgressSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import { buildTaskProgressSegments, resolveViewportIndices, type TaskProgressSegment } from './useTaskProgressBarComputation.js';
import { useTaskProgressBarInteraction } from './useTaskProgressBarInteraction.js';

export type { TaskProgressSegment } from './useTaskProgressBarComputation.js';

export type TaskProgressData = {
  viewWidth: number;
  segments: TaskProgressSegment[];
  stageOffsets: Map<string, number>;
  stageCounts: Map<string, number>;
  waitingColor: string;
  emptyColor: string;
  flowBandRange: { x: number; width: number } | null;
  flowBandClipId: string;
  flowBandWidth: number;
  showFlowBand: boolean;
  viewportStartGlobal: number | null;
  viewportEndGlobal: number | null;
  onActivateTaskSegment: (segment: TaskProgressSegment) => void;
  onPointerDown: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: PointerEvent<SVGSVGElement>) => void;
};

export type TaskProgressBarProps = TaskProgressBarStateOptions;

export type TaskProgressBarStateOptions = {
  stages: BuildStage[];
  tasksByStage: Record<string, TaskItemWithMetadata[]>;
  stageTotals?: TaskProgressSummary['stageTotals'];
  buildStatus: TaskProgressSummary['buildStatus'];
  activeStageId?: string | null;
  resolveTaskTitle: (task: TaskItemWithMetadata) => string;
};

export const useTaskProgressBarState = ({
  stages,
  tasksByStage,
  stageTotals,
  buildStatus,
  activeStageId,
  resolveTaskTitle,
}: TaskProgressBarStateOptions): TaskProgressData => {
  const theme = useTheme();
  const filter = useBuildStageFilter();
  const flowBandClipId = useId().replace(/:/g, '');
  const viewportRange = useAtomValue(taskViewportRangeAtom);

  const waitingColor = theme.palette.grey[300];
  const emptyColor = buildStatus === 'failed' ? theme.palette.error.main : theme.palette.grey[500];
  const runningColor = theme.palette.info.main;
  const failedColor = theme.palette.error.main;
  const skippedColor = theme.palette.warning.main;
  const successColor = theme.palette.success.main;
  const pausedColor = theme.palette.warning.main;

  const computeInput = useMemo(() => ({
    stages,
    tasksByStage,
    stageTotals,
    activeStageId,
    buildStatus,
    resolveTaskTitle,
    waitingColor,
    successColor,
    failedColor,
    runningColor,
    pausedColor,
    skippedColor,
    filter: {
      skippedMode: filter.skippedMode,
      failedMode: filter.failedMode,
      completedMode: filter.completedMode,
    },
  }), [
    activeStageId,
    buildStatus,
    filter.completedMode,
    filter.failedMode,
    filter.skippedMode,
    runningColor,
    pausedColor,
    resolveTaskTitle,
    failedColor,
    stageTotals,
    stages,
    skippedColor,
    successColor,
    tasksByStage,
    waitingColor,
  ]);

  const {
    segments,
    stageOffsets,
    stageCounts,
    viewWidth,
  } = useMemo(() => buildTaskProgressSegments(computeInput), [computeInput]);

  const isSelfActiveStage = Boolean(activeStageId && stages.some((stage) => stage.id === activeStageId));
  const showFlowBand = buildStatus === 'running' && isSelfActiveStage;

  const { viewportStartIndex, viewportEndIndex } = resolveViewportIndices(viewportRange, tasksByStage);
  const { viewportStartGlobal, viewportEndGlobal } = useMemo(() => {
    if (!viewportRange?.stageId || viewportStartIndex === null || viewportEndIndex === null) {
      return { viewportStartGlobal: null, viewportEndGlobal: null };
    }
    const stageOffset = stageOffsets.get(viewportRange.stageId);
    if (stageOffset === undefined) return { viewportStartGlobal: null, viewportEndGlobal: null };
    return {
      viewportStartGlobal: stageOffset + viewportStartIndex,
      viewportEndGlobal: stageOffset + viewportEndIndex,
    };
  }, [viewportEndIndex, viewportRange?.stageId, viewportStartIndex, stageOffsets]);

  const flowBandRange = useMemo(() => {
    if (!showFlowBand || !activeStageId) return null;
    const stageOffset = stageOffsets.get(activeStageId);
    const stageCount = stageCounts.get(activeStageId) ?? 0;
    if (stageOffset === undefined || stageCount <= 0) return null;
    return { x: stageOffset, width: stageCount };
  }, [activeStageId, showFlowBand, stageCounts, stageOffsets]);

  const interaction = useTaskProgressBarInteraction({
    segments,
    viewWidth,
  });

  return {
    viewWidth,
    segments,
    stageOffsets,
    stageCounts,
    waitingColor,
    emptyColor,
    flowBandRange,
    flowBandClipId,
    flowBandWidth: viewWidth * 0.1,
    showFlowBand,
    viewportStartGlobal,
    viewportEndGlobal,
    onPointerDown: interaction.onPointerDown,
    onPointerMove: interaction.onPointerMove,
    onPointerUp: interaction.onPointerUp,
    onActivateTaskSegment: interaction.onActivateTaskSegment,
  };
};
