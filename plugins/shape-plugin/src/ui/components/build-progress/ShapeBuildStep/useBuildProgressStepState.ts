import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import { useHeapPressureGuard } from '@hierarchidb/ui-memory';
import { createStore } from 'jotai/vanilla';
import { useCallback, useEffect, useMemo, useState } from 'react';

export const useBuildProgressStepState = (buildStatus: BuildStatus) => {
  const store = useMemo(() => createStore(), []);
  const [heapDialogOpen, setHeapDialogOpen] = useState(false);
  const { event: heapEvent, dismiss: dismissHeapEvent } = useHeapPressureGuard({
    enabled: buildStatus === 'running' || buildStatus === 'paused',
  });

  useEffect(() => {
    if (!heapEvent) return;
    setHeapDialogOpen(true);
  }, [heapEvent]);

  const handleHeapDialogClose = useCallback(() => {
    setHeapDialogOpen(false);
    dismissHeapEvent();
  }, [dismissHeapEvent]);

  return {
    store,
    heapDialogOpen,
    heapEvent,
    handleHeapDialogClose,
  };
};
