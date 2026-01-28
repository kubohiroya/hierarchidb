import { Provider, useAtomValue } from 'jotai';
import { ShapeBuildProgressAtomSync } from './ShapeBuildProgressAtomSync.js';
import { ShapeBuildProgressPanel } from './ShapeBuildProgressPanel.js';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { taskStatusAtom } from '../../atoms/shapeBuildProgressAtoms.ts';
import { HeapPressureDialog } from '@hierarchidb/ui-memory';
import type { ShapeDialogStepProps } from '../ShapeDialogStepProps.tsx';
import type { NodeId } from '@hierarchidb/common-types';
import { useBuildProgressStepState } from './useBuildProgressStepState.ts';

export const ShapeBuildStep: React.FC<ShapeDialogStepProps> = (props) => {
  const { t } = useTranslation();
  const buildStatus = useAtomValue(taskStatusAtom);
  const { store, heapDialogOpen, heapEvent, handleHeapDialogClose } = useBuildProgressStepState(buildStatus);

  return (
    <Provider store={store}>
      <ShapeBuildProgressAtomSync {...props} />
      <ShapeBuildProgressPanel data={props.data} nodeId={props.nodeId as NodeId} />
      <HeapPressureDialog
        open={heapDialogOpen}
        event={heapEvent}
        onClose={handleHeapDialogClose}
        title={t('stage.heap.pauseTitle', 'Memory pressure detected')??''}
        confirmLabel={t('stage.heap.pauseConfirm', 'OK')??''}
        description={t('stage.heap.pauseHint', 'Reduce concurrency and try again if the build becomes unstable.')??''}
      />
    </Provider>
  );
};
