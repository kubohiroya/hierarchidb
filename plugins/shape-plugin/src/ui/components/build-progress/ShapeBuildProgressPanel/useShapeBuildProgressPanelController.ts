import { useShapeBuildProgressPanelControllerBase } from './useShapeBuildProgressPanelController/useShapeBuildProgressPanelControllerBase.js';
import { useShapeBuildProgressPanelControllerOverlay } from './useShapeBuildProgressPanelController/useShapeBuildProgressPanelControllerOverlay.js';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeEntity } from '../../../../common/types/ShapeEntity.js';

export type ShapeBuildProgressPanelControllerProps = {
  data?: Partial<ShapeEntity>;
  nodeId?: NodeId;
  onChange?: (patch: Partial<ShapeEntity>) => void;
};

export const useShapeBuildProgressPanelController = (props: ShapeBuildProgressPanelControllerProps) => {
  const base = useShapeBuildProgressPanelControllerBase(props);
  const overlay = useShapeBuildProgressPanelControllerOverlay(base);

  return {
    ...base,
    ...overlay,
  } as const;
};
