import { useEffect, useMemo, useState } from 'react';
import { Provider, useAtomValue } from 'jotai';
import { createStore } from 'jotai/vanilla';
import { ShapeBuildProgressAtomSync } from './ShapeBuildProgressAtomSync.js';
import { ShapeBuildProgressPanel } from './ShapeBuildProgressPanel.js';
import { useTranslation } from '@hierarchidb/ui-i18n';
import { taskStatusAtom } from '../../atoms/shapeBuildProgressAtoms.ts';
import { HeapPressureDialog, useHeapPressureGuard } from '@hierarchidb/ui-memory';
import type { ShapeDialogStepProps } from '../ShapeDialogStepProps.tsx';
import type { NodeId } from '@hierarchidb/common-types';

export const ShapeBuildStep: React.FC<ShapeDialogStepProps> = (props) => {
  const store = useMemo(() => createStore(), []);

  const { t } = useTranslation();
  const buildStatus = useAtomValue(taskStatusAtom);
  const [heapDialogOpen, setHeapDialogOpen] = useState(false);
  const { event: heapEvent, dismiss: dismissHeapEvent } = useHeapPressureGuard({
    enabled: buildStatus === 'running' || buildStatus === 'paused',
  });

  useEffect(() => {
    if (!heapEvent) return;
    setHeapDialogOpen(true);
  }, [heapEvent]);

  return (
    <Provider store={store}>
      <ShapeBuildProgressAtomSync {...props} />
      <ShapeBuildProgressPanel data={props.data} nodeId={props.nodeId as NodeId} />
      <HeapPressureDialog
        open={heapDialogOpen}
        event={heapEvent}
        onClose={() => {
          setHeapDialogOpen(false);
          dismissHeapEvent();
        }}
        title={t('stage.heap.pauseTitle', 'Memory pressure detected')??''}
        confirmLabel={t('stage.heap.pauseConfirm', 'OK')??''}
        description={t('stage.heap.pauseHint', 'Reduce concurrency and try again if the build becomes unstable.')??''}
      />
    </Provider>
  );
};
