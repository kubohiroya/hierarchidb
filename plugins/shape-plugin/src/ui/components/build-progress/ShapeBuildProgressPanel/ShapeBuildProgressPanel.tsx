import { type NodeId } from '@hierarchidb/core-types';
import { useShapeBuildProgressPanelController } from './useShapeBuildProgressPanelController.js';
import { useShapeBuildProgressPanelViewModel } from './useShapeBuildProgressPanelViewModel.tsx';
import { ShapeBuildProgressPanelView } from './ShapeBuildProgressPanelView.tsx';
import type { ShapeEntity } from '../../../../common/types/ShapeEntity.js';

type ShapeBuildProgressPanelProps = {
  data?: Partial<ShapeEntity>;
  nodeId?: NodeId;
  onChange?: (patch: Partial<ShapeEntity>) => void;
};

export const ShapeBuildProgressPanel = ({
  data,
  nodeId,
  onChange,
}: ShapeBuildProgressPanelProps) => {
  const coreState = useShapeBuildProgressPanelController({ data, nodeId, onChange });
  const viewModel = useShapeBuildProgressPanelViewModel({
    coreState,
    nodeId,
  });

  return <ShapeBuildProgressPanelView {...viewModel} />;
};
