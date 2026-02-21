/**
 * Command processor tracker.
 *
 * Keeps the TreeConsole UI in sync with undo/redo capabilities
 * exposed by the Worker command processor.
 */

import type { BuildWorkerAPI } from '~/types/worker-api';
import type { TreeSubscriptionAPI } from '@hierarchidb/tree-api';
import type { SubscriptionId, UndoStateEvent } from '@hierarchidb/tree-api';
import { proxy, type Remote } from 'comlink';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import type { TreeConsoleSSOTEntry } from '~/state/treeconsole.atoms';
import type { MaybeCP, TreeConsoleState } from './types.js';
import { sanitizeForComlink } from '~/utils/comlinkSanitizer';

interface Params {
  client: Remote<BuildWorkerAPI> | undefined;
  setState: Dispatch<SetStateAction<TreeConsoleState>>;
  setSSOT: (patch: Partial<TreeConsoleSSOTEntry>) => void;
}

export function useCommandProcessorTracker({ client, setState, setSSOT }: Params) {
  const refreshUndoRedo = useCallback(async () => {
    try {
      const getCP = (client as unknown as MaybeCP | undefined)?.getCommandProcessor;
      if (typeof getCP !== 'function') return;
      const cp = await getCP();
      if (!cp) return;
      const canUndo = typeof cp.canUndo === 'function' ? Boolean(cp.canUndo()) : false;
      const canRedo = typeof cp.canRedo === 'function' ? Boolean(cp.canRedo()) : false;
      setState((prev) =>
        prev.canUndo === canUndo && prev.canRedo === canRedo ? prev : { ...prev, canUndo, canRedo }
      );
    } catch {
      // Swallow errors caused by optional command processor implementations.
    }
  }, [client, setState]);

  useEffect(() => {
    const handler = () => {
      void refreshUndoRedo();
    };
    window.addEventListener('hdb-cmd', handler as EventListener);
    return () => window.removeEventListener('hdb-cmd', handler as EventListener);
  }, [refreshUndoRedo]);

  const subscriptionEstablishedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!client) return;
    let isActive = true;
    let subscriptionId: SubscriptionId | undefined;
    let subscriptionAPI: Awaited<ReturnType<typeof client.getSubscriptionAPI>> | undefined;

    const attach = async () => {
      try {
        subscriptionAPI = await client.getSubscriptionAPI();
        const handler = proxy((event: UndoStateEvent) => {
          if (!isActive) return;
          const safeEvent = sanitizeForComlink(event);
          const { canUndo, canRedo } = safeEvent as UndoStateEvent;
          subscriptionEstablishedRef.current = true;
          setState((prev) =>
            prev.canUndo === canUndo && prev.canRedo === canRedo
              ? prev
              : { ...prev, canUndo, canRedo }
          );
          setSSOT({ canUndo, canRedo });
        });

        subscriptionId = await subscriptionAPI.subscribeUndoState(handler);
      } catch (error) {
        console.warn('[useCommandProcessorTracker] undo-atoms subscription failed', error);
      }
    };

    void attach();

    return () => {
      isActive = false;
      if (subscriptionId && subscriptionAPI) {
        void subscriptionAPI.unsubscribe(subscriptionId).catch(() => {});
      } else if (subscriptionId) {
        const pendingId = subscriptionId;
        void client
          .getSubscriptionAPI()
          .then((api: TreeSubscriptionAPI) => api.unsubscribe(pendingId))
          .catch(() => {});
      }
    };
  }, [client, setSSOT, setState]);

  useEffect(() => {
    let stopped = false;
    let cp: unknown;

    const tick = async () => {
      try {
        const getCP = (client as unknown as MaybeCP | undefined)?.getCommandProcessor;
        if (typeof getCP !== 'function') return;
        cp = cp || (await getCP());
        if (!cp) return;
        const typed = cp as { canUndo?: () => boolean; canRedo?: () => boolean };
        const canUndo = typeof typed.canUndo === 'function' ? Boolean(typed.canUndo()) : false;
        const canRedo = typeof typed.canRedo === 'function' ? Boolean(typed.canRedo()) : false;
        setState((prev) =>
          prev.canUndo === canUndo && prev.canRedo === canRedo
            ? prev
            : { ...prev, canUndo, canRedo }
        );
        setSSOT({ canUndo, canRedo });
      } catch {
        // Ignore polling errors to keep UI responsive.
      }
    };

    void tick();
    const id = globalThis.setInterval(() => {
      if (!stopped && !subscriptionEstablishedRef.current) void tick();
    }, 600);

    return () => {
      stopped = true;
      globalThis.clearInterval(id);
    };
  }, [client, setSSOT, setState]);

  return refreshUndoRedo;
}
