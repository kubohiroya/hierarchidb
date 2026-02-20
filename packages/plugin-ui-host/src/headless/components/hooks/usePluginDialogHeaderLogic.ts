import { useDialogContext } from '@hierarchidb/ui-dialog';
import { useCallback, useMemo } from 'react';
import type { DialogActionInFlight } from '~/headless/types';

type WorkerStepState = {
  id: string;
  enabled?: boolean;
  completed?: boolean;
  error?: string | null;
};
type WorkerDialogState = { steps?: WorkerStepState[] };

export function usePluginDialogHeaderLogic(params: {
  dialogState?: WorkerDialogState | null;
  pendingAction?: DialogActionInFlight | null;
}) {
  const { dialogState, pendingAction } = params;
  const ctx = useDialogContext<Record<string, unknown>>();
  const navigationLocked = Boolean(pendingAction);

  const workerStepMap = useMemo(() => {
    const steps = dialogState?.steps;
    if (!steps?.length) return null;
    const map = new Map<string, WorkerStepState>();
    steps.forEach((step) => {
      map.set(step.id, step);
    });
    return map;
  }, [dialogState?.steps]);

  const toggleMaximize = useCallback(() => {
    const next = ctx.displayMode === 'maximize' ? 'normal' : 'maximize';
    ctx.onDisplayModeChange?.(next);
  }, [ctx]);

  const toggleFullscreen = useCallback(() => {
    if (!ctx.allowFullScreen) return;
    const next = ctx.displayMode === 'full-screen' ? 'normal' : 'full-screen';
    ctx.onDisplayModeChange?.(next);
  }, [ctx]);

  const toggleMinimize = useCallback(() => {
    if (!ctx.onMinimizeChange) return;
    ctx.onMinimizeChange(!(ctx.isMinimized ?? false));
  }, [ctx]);

  const handleStepClick = useCallback(
    (event: React.MouseEvent | React.KeyboardEvent, index: number, canNavigate: boolean) => {
      if (!canNavigate || index === ctx.activeStepIndex || navigationLocked) {
        event.preventDefault();
        return;
      }
      ctx.onStepNavigate({ type: 'direct', targetIndex: index });
    },
    [ctx, navigationLocked]
  );

  return {
    ctx,
    workerStepMap,
    navigationLocked,
    toggleMaximize,
    toggleFullscreen,
    toggleMinimize,
    handleStepClick,
  };
}
