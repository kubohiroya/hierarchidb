import { useMemo } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeEntity } from '../../../common/types/ShapeEntity.ts';
import { useBuildProgressPanelState } from './useBuildProgressPanelState.ts';

export const useShapeBuildProgressPanel = ({
  data,
  nodeId,
}: {
  data?: Partial<ShapeEntity>;
  nodeId?: NodeId;
}) => {
  const state = useBuildProgressPanelState({ data, nodeId });

  const stageProgressItems = useMemo(
    () => state.stages.map((stage) => ({
      stage,
      tasks: state.tasksByStage[stage.id] ?? [],
    })),
    [state.stages, state.tasksByStage],
  );

  const stageContentItems = useMemo(
    () => state.stages.map((stage) => ({
      stage,
      stageValue: state.resolveStageValue(stage.id),
    })),
    [state.stages, state.resolveStageValue],
  );

  return {
    ...state,
    stageProgressItems,
    stageContentItems,
  };
};
