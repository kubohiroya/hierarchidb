import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeEntity } from '~/common/types/ShapeEntity';
import { useShapeBuildProgressPanelControllerBaseStateDataCore } from './useShapeBuildProgressPanelControllerBaseState/useShapeBuildProgressPanelControllerBaseStateDataCore.js';

export type ShapeBuildProgressPanelControllerBaseResult =
  ReturnType<typeof useShapeBuildProgressPanelControllerBaseStateDataCore>;

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
  return useShapeBuildProgressPanelControllerBaseStateDataCore({ data, nodeId, onChange });
};
