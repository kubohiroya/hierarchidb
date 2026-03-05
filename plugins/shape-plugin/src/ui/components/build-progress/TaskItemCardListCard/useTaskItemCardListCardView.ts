import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { useShapeBuildStages } from '~/ui/components/build-progress/useShapeBuildStages/useShapeBuildStages';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';
import type { TaskDetailSelection } from '~/ui/components/build-progress/TaskItemCard/TaskItemDetailTypes';
import type { TaskItemWithMetadata } from '~/ui/components/build-progress/taskItemCardList/types';
import type {
  TaskOutcomeSummaryBuilder,
} from '~/ui/components/build-progress/TaskItemCard/taskOutcomeSummaryBuilders';
import {
  buildGeometryTaskOutcomeSummary,
  buildSimpleTaskOutcomeSummary,
  buildSourceTaskOutcomeSummary,
} from '~/ui/components/build-progress/TaskItemCard/taskOutcomeSummaryBuilders';
import {
  isGeometryLikeStageId,
  isTileEmitLikeStageId,
} from '~/ui/components/build-progress/stageIdAliases';

type TaskStageSummaryBuilderMap = Partial<Record<
  'source' | 'geometry' | 'tileEmit',
  TaskOutcomeSummaryBuilder
>>;

type Args = {
  isDetailFloatingWindowOpen: boolean;
  onOpenDetailFloatingWindow?: () => void;
  onCloseDetailFloatingWindow?: () => void;
  resolveTaskTitle: (task: TaskItemWithMetadata) => string;
  resolveStatusLabel: (statusValue?: string, skipped?: boolean) => string;
  resolveStatusColor: (statusValue?: string, skipped?: boolean) => 'default' | 'success' | 'error' | 'warning' | 'info';
  stageValue: number;
  summaryBuilders?: TaskStageSummaryBuilderMap;
};

export const useTaskItemCardListCardView = ({
  isDetailFloatingWindowOpen,
  onOpenDetailFloatingWindow,
  onCloseDetailFloatingWindow,
  resolveTaskTitle,
  resolveStatusLabel,
  resolveStatusColor,
  stageValue,
  summaryBuilders,
}: Args) => {
  const [hoveredDetail, setHoveredDetail] = useState<TaskDetailSelection | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<TaskDetailSelection | null>(null);
  const wasDetailFloatingWindowOpenRef = useRef(isDetailFloatingWindowOpen);
  const openRequestRef = useRef<string | null>(null);
  const suppressOpenRef = useRef(false);
  const { t } = useTranslation();
  const stages = useShapeBuildStages({ t: (key, fallback): string => String(t(key, fallback ?? key)) });
  const stageIconById = useMemo(() => (
    new Map(stages.map((stage) => [stage.id, stage.icon]))
  ), [stages]);
  const resolveStageIcon = useCallback((taskStageId: string): ReactNode | null => (
    stageIconById.get(taskStageId) ?? null
  ), [stageIconById]);

  useEffect(() => {
    const wasOpen = wasDetailFloatingWindowOpenRef.current;
    if (wasOpen && !isDetailFloatingWindowOpen) {
      setSelectedDetail(null);
      setHoveredDetail(null);
      openRequestRef.current = null;
      suppressOpenRef.current = false;
    }
    wasDetailFloatingWindowOpenRef.current = isDetailFloatingWindowOpen;
  }, [isDetailFloatingWindowOpen]);

  useEffect(() => {
    if (!selectedDetail || isDetailFloatingWindowOpen) return;
    if (suppressOpenRef.current) return;
    const selectedId = selectedDetail.task.taskId ?? selectedDetail.title;
    if (openRequestRef.current === selectedId) return;
    openRequestRef.current = selectedId;
    onOpenDetailFloatingWindow?.();
  }, [isDetailFloatingWindowOpen, onOpenDetailFloatingWindow, selectedDetail]);

  const handleCloseDetail = useCallback(() => {
    suppressOpenRef.current = true;
    setSelectedDetail(null);
    setHoveredDetail(null);
    openRequestRef.current = null;
    onCloseDetailFloatingWindow?.();
  }, [onCloseDetailFloatingWindow]);

  const resolveTaskCardView = useCallback((task: ShapeBuildTaskSummary) => {
    const taskStageId = task.stage;
    const stageIcon = resolveStageIcon(taskStageId);
    const injectedBuilder = (isGeometryLikeStageId(taskStageId)
      ? summaryBuilders?.geometry
      : (isTileEmitLikeStageId(taskStageId)
        ? summaryBuilders?.tileEmit
        : summaryBuilders?.source));
    const summaryBuilder = injectedBuilder
      ?? (
        isGeometryLikeStageId(taskStageId)
          ? buildGeometryTaskOutcomeSummary
          : (isTileEmitLikeStageId(taskStageId) ? buildSimpleTaskOutcomeSummary : buildSourceTaskOutcomeSummary)
      );
    const currentTaskDetailId = task.taskId ?? resolveTaskTitle(task as TaskItemWithMetadata);
    const selectedTaskDetailId = selectedDetail?.task.taskId ?? selectedDetail?.title;
    const hoveredTaskDetailId = hoveredDetail?.task.taskId ?? hoveredDetail?.title;
    const isDetailSelected = selectedTaskDetailId === currentTaskDetailId;
    const isDetailHoverPreviewActive = !selectedDetail && hoveredTaskDetailId === currentTaskDetailId;

    const handleDetailHoverChange = (value: TaskDetailSelection | null) => {
      if (selectedDetail) return;
      setHoveredDetail(value);
    };
    const handleDetailClick = (value: TaskDetailSelection) => {
      setHoveredDetail(null);
      setSelectedDetail((previous) => {
        const previousId = previous?.task.taskId ?? previous?.title;
        const clickedId = value.task.taskId ?? value.title;
        if (previousId === clickedId) return null;
        return value;
      });
    };

    return {
      isDetailHoverPreviewActive,
      isDetailSelected,
      stageIcon,
      stageValue,
      summaryBuilder,
      t,
      taskStageId,
      resolveStatusColor,
      resolveStatusLabel,
      handleDetailHoverChange,
      handleDetailClick,
    };
  }, [hoveredDetail, resolveStageIcon, resolveStatusColor, resolveStatusLabel, resolveTaskTitle, selectedDetail, stageValue, summaryBuilders, t]);

  const createTaskCardStyle = useCallback((start: number, size: number): CSSProperties => ({
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    transform: `translateY(${start}px)`,
    paddingRight: 2,
    height: `${size}px`,
  }), []);

  return {
    createTaskCardStyle,
    detail: selectedDetail ?? hoveredDetail,
    handleCloseDetail,
    resolveTaskCardView,
  };
};
