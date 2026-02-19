import { useTranslation } from '@hierarchidb/ui-i18n';
import { Provider, useAtomValue } from 'jotai';
import type { NodeId } from '@hierarchidb/core-types';

import {
  taskStatusAtom,
} from '~/ui/atoms/shapeBuildProgressAtoms';
import { HeapPressureDialog } from '@hierarchidb/ui-memory';

import { useBuildProgressStepState } from './useBuildProgressStepState.js';
import { useShapeBuildStepAtomSync } from './useShapeBuildStepAtomSync/index.js';
import type { ShapeDialogStepProps } from '~/ui/components/ShapeDialogStepProps';
import { ShapeBuildProgressPanel } from '~/ui/components/build-progress/ShapeBuildProgressPanel/ShapeBuildProgressPanel';


const ShapeBuildAtomSync: React.FC<ShapeDialogStepProps> = (props) => {
  useShapeBuildStepAtomSync(props);
  return null;
};

export const ShapeBuildStep: React.FC<ShapeDialogStepProps> = (props) => {
  const { t } = useTranslation();
  const buildStatus = useAtomValue(taskStatusAtom);
  const { store, heapDialogOpen, heapEvent, handleHeapDialogClose } = useBuildProgressStepState(buildStatus);

  return (
    <Provider store={store}>
      <ShapeBuildAtomSync {...props} />
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
