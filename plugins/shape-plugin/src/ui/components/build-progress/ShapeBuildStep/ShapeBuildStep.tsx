import { useTranslation } from '@hierarchidb/ui-i18n';
import { Provider, useAtomValue } from 'jotai';
import type { NodeId } from '@hierarchidb/core-types';
import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import { buildSessionRuntimeAtom } from '~/ui/atoms/buildSessionStateAtoms';
import { HeapPressureDialog } from '@hierarchidb/ui-memory';

import { useBuildProgressStepState } from './useBuildProgressStepState.js';
import type { ShapeDialogStepProps } from '~/ui/components/ShapeDialogStepProps';
import { ShapeBuildProgressPanel } from '~/ui/components/build-progress/ShapeBuildProgressPanel/ShapeBuildProgressPanel';

const toBuildStatus = (phase: string): BuildStatus => {
  if (phase === 'running' || phase === 'starting' || phase === 'resuming' || phase === 'pausing' || phase === 'finalizing') {
    return 'running';
  }
  if (phase === 'paused') return 'paused';
  if (phase === 'completed') return 'completed';
  if (phase === 'failed') return 'failed';
  return 'idle';
};

export const ShapeBuildStep: React.FC<ShapeDialogStepProps> = (props) => {
  const { t } = useTranslation('shape-plugin');
  const runtime = useAtomValue(buildSessionRuntimeAtom);
  const buildStatus = toBuildStatus(runtime.phase);
  const { store, heapDialogOpen, heapEvent, handleHeapDialogClose } = useBuildProgressStepState(buildStatus);

  return (
    <Provider store={store}>
      <ShapeBuildProgressPanel
        data={props.data}
        nodeId={props.nodeId as NodeId}
        onChange={props.onChange}
      />
      <HeapPressureDialog
        open={heapDialogOpen}
        event={heapEvent}
        onClose={handleHeapDialogClose}
        title={t('stage.heap.pauseTitle', 'Memory pressure detected') ?? ''}
        confirmLabel={t('stage.heap.pauseConfirm', 'OK') ?? ''}
        description={t('stage.heap.pauseHint', 'Reduce concurrency and try again if the build becomes unstable.') ?? ''}
      />
    </Provider>
  );
};
