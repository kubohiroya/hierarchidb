import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeEntity } from '../../../../../../common/types/ShapeEntity.js';
import { useShapeBuildProgressPanelControllerBaseStateData } from './useShapeBuildProgressPanelControllerBaseState/useShapeBuildProgressPanelControllerBaseStateData.js';

export type ShapeBuildProgressPanelControllerBaseResult =
  ReturnType<typeof useShapeBuildProgressPanelControllerBaseStateData>;

type ShapeBuildProgressPanelControllerProps = {
  data?: Partial<ShapeEntity>;
  nodeId?: NodeId;
  onChange?: (patch: Partial<ShapeEntity>) => void;
};

export const useShapeBuildProgressPanelControllerBase = ({
  data,
  nodeId,
  onChange,
}: ShapeBuildProgressPanelControllerProps) => {
  const state = useShapeBuildProgressPanelControllerBaseStateData({ data, nodeId, onChange });
  return state;
};
