import { useCallback, useMemo } from 'react';
import { useDialogContext } from '@hierarchidb/ui-dialog';
import { useLocation } from '@tanstack/react-router';
import type { DialogActionInFlight } from '../../types.js';

type WorkerStepState = { id: string; enabled?: boolean; completed?: boolean; error?: string | null };
type WorkerDialogState = { steps?: WorkerStepState[] };

export function usePluginDialogHeaderLogic(params: {
  dialogState?: WorkerDialogState | null;
  pendingAction?: DialogActionInFlight | null;
}) {
  const { dialogState, pendingAction } = params;
  const ctx = useDialogContext<Record<string, unknown>>();
  const location = useLocation();

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
    const next = ctx.displayMode === 'full-screen' ? 'normal' : 'full-screen';
    ctx.onDisplayModeChange?.(next);
  }, [ctx]);

  const buildStepLink = useCallback(
    (index: number) => {
      const rawSearch = location.searchStr ? location.searchStr.slice(1) : '';
      const params = new URLSearchParams(rawSearch);
      params.set('step', String(index));
      const query = params.toString();
      let pathname = location.pathname || '';
      if (!pathname && typeof window !== 'undefined') {
        const hashPath = window.location.hash?.replace(/^#/, '') || '';
        pathname = hashPath || window.location.pathname || '';
      }
      if (!pathname) {
        pathname = '/';
      } else if (!pathname.startsWith('/')) {
        pathname = `/${pathname}`;
      }
      const hash = location.hash ?? '';
      const safeHash = hash && !hash.startsWith('#/') ? hash : '';
      return `${pathname}${query ? `?${query}` : ''}${safeHash}`;
    },
    [location.pathname, location.searchStr, location.hash]
  );

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
    buildStepLink,
    handleStepClick,
  };
}
