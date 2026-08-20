import { type NodeId } from '@hierarchidb/core-types';
import { useShapeBuildProgressPanelController } from './useShapeBuildProgressPanelController.js';
import { useShapeBuildProgressPanelViewModel } from './useShapeBuildProgressPanelViewModel.js';
import { BuildSessionProgressPanel } from '@hierarchidb/ui-build-progress';
import type { ShapeEntity } from '~/common/types/ShapeEntity';
import { ShapeBuildProgressPanelLegacySessionRecoveryDialogView } from './ShapeBuildProgressPanelLegacySessionRecoveryDialogView.js';

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

  return (
    <>
      <BuildSessionProgressPanel {...viewModel} />
      {coreState.legacySessionRecoveryError ? (
        <ShapeBuildProgressPanelLegacySessionRecoveryDialogView
          open={coreState.legacySessionRecoveryDialogOpen}
          pending={coreState.isResetSessionLoading}
          error={coreState.legacySessionRecoveryError}
          failureMessage={coreState.legacySessionRecoveryFailure}
          onCancel={coreState.handleLegacySessionRecoveryCancel}
          onConfirm={coreState.handleLegacySessionRecoveryConfirm}
          t={coreState.t}
        />
      ) : null}
    </>
  );
};
