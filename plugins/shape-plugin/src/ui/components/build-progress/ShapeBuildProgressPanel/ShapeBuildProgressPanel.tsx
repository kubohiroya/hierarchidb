import { type NodeId } from '@hierarchidb/core-types';
import { useShapeBuildProgressPanelController } from './useShapeBuildProgressPanelController.js';
import { useShapeBuildProgressPanelViewModel } from './useShapeBuildProgressPanelViewModel.tsx';
import { BuildSessionProgressPanelShell } from '@hierarchidb/ui-build-progress';
import type { ShapeEntity } from '~/common/types/ShapeEntity';

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

  return <BuildSessionProgressPanelShell {...viewModel} />;
};
