import { useCallback, useEffect, useMemo, useState } from 'react';
import { createStore } from 'jotai/vanilla';
import { useHeapPressureGuard } from '@hierarchidb/ui-memory';
import type { BuildStatus } from '@hierarchidb/components/build-status';

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
