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
  tasks: ShapeBuildTaskSummary[];
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
  tasks,
  isDetailFloatingWindowOpen,
  onOpenDetailFloatingWindow,
  onCloseDetailFloatingWindow,
  resolveTaskTitle,
  resolveStatusLabel,
  resolveStatusColor,
  stageValue,
  summaryBuilders,
}: Args) => {
  const [hoveredTaskDetailId, setHoveredTaskDetailId] = useState<string | null>(null);
  const [selectedTaskDetailId, setSelectedTaskDetailId] = useState<string | null>(null);
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
  const resolveSummaryBuilder = useCallback((taskStageId: string): TaskOutcomeSummaryBuilder => {
    const injectedBuilder = (isGeometryLikeStageId(taskStageId)
      ? summaryBuilders?.geometry
      : (isTileEmitLikeStageId(taskStageId)
        ? summaryBuilders?.tileEmit
        : summaryBuilders?.source));
    return injectedBuilder
      ?? (
        isGeometryLikeStageId(taskStageId)
          ? buildGeometryTaskOutcomeSummary
          : (isTileEmitLikeStageId(taskStageId) ? buildSimpleTaskOutcomeSummary : buildSourceTaskOutcomeSummary)
      );
  }, [summaryBuilders]);
  const taskByDetailId = useMemo(() => {
    const map = new Map<string, ShapeBuildTaskSummary>();
    tasks.forEach((task) => {
      const taskDetailId = task.taskId ?? resolveTaskTitle(task as TaskItemWithMetadata);
      map.set(taskDetailId, task);
    });
    return map;
  }, [resolveTaskTitle, tasks]);
  const resolveDetailSelection = useCallback((detailId: string | null): TaskDetailSelection | null => {
    if (!detailId) return null;
    const task = taskByDetailId.get(detailId);
    if (!task) return null;
    const taskTitle = resolveTaskTitle(task as TaskItemWithMetadata);
    const summary = resolveSummaryBuilder(task.stage)({
      task,
      stageId: task.stage,
      taskTitle,
      translate: t,
    });
    return {
      title: taskTitle,
      summary,
      task,
    };
  }, [resolveSummaryBuilder, resolveTaskTitle, t, taskByDetailId]);
  const detail = useMemo(() => (
    resolveDetailSelection(selectedTaskDetailId) ?? resolveDetailSelection(hoveredTaskDetailId)
  ), [hoveredTaskDetailId, resolveDetailSelection, selectedTaskDetailId]);

  useEffect(() => {
    const wasOpen = wasDetailFloatingWindowOpenRef.current;
    if (wasOpen && !isDetailFloatingWindowOpen) {
      setSelectedTaskDetailId(null);
      setHoveredTaskDetailId(null);
      openRequestRef.current = null;
      suppressOpenRef.current = false;
    }
    wasDetailFloatingWindowOpenRef.current = isDetailFloatingWindowOpen;
  }, [isDetailFloatingWindowOpen]);

  useEffect(() => {
    if (!selectedTaskDetailId || isDetailFloatingWindowOpen) return;
    if (suppressOpenRef.current) return;
    if (openRequestRef.current === selectedTaskDetailId) return;
    openRequestRef.current = selectedTaskDetailId;
    onOpenDetailFloatingWindow?.();
  }, [isDetailFloatingWindowOpen, onOpenDetailFloatingWindow, selectedTaskDetailId]);

  const handleCloseDetail = useCallback(() => {
    suppressOpenRef.current = true;
    setSelectedTaskDetailId(null);
    setHoveredTaskDetailId(null);
    openRequestRef.current = null;
    onCloseDetailFloatingWindow?.();
  }, [onCloseDetailFloatingWindow]);

  const resolveTaskCardView = useCallback((task: ShapeBuildTaskSummary) => {
    const taskStageId = task.stage;
    const stageIcon = resolveStageIcon(taskStageId);
    const summaryBuilder = resolveSummaryBuilder(taskStageId);
    const currentTaskDetailId = task.taskId ?? resolveTaskTitle(task as TaskItemWithMetadata);
    const isDetailSelected = selectedTaskDetailId === currentTaskDetailId;
    const isDetailHoverPreviewActive = !selectedTaskDetailId && hoveredTaskDetailId === currentTaskDetailId;

    const handleDetailHoverChange = (value: TaskDetailSelection | null) => {
      if (selectedTaskDetailId) return;
      setHoveredTaskDetailId(value?.task.taskId ?? value?.title ?? null);
    };
    const handleDetailClick = (value: TaskDetailSelection) => {
      const clickedId = value.task.taskId ?? value.title;
      setHoveredTaskDetailId(null);
      setSelectedTaskDetailId((previousId) => (previousId === clickedId ? null : clickedId));
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
  }, [hoveredTaskDetailId, resolveStageIcon, resolveStatusColor, resolveStatusLabel, resolveSummaryBuilder, resolveTaskTitle, selectedTaskDetailId, stageValue, t]);

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
    detail,
    handleCloseDetail,
    resolveTaskCardView,
  };
};
