/**
 * Command processor tracker.
 *
 * Keeps the TreeConsole UI in sync with undo/redo capabilities
 * exposed by the Worker command processor.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Remote } from 'comlink';
import type { WorkerAPI } from '@hierarchidb/common-api';
import type { SubscriptionId, UndoStateEvent } from '@hierarchidb/common-type';
import type { TreeConsoleSSOTEntry } from '~/state/treeconsole.atoms.js';
import type { MaybeCP, TreeConsoleState } from './types.js';

interface Params {
  client: Remote<WorkerAPI> | undefined;
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
      setState((prev) => (prev.canUndo === canUndo && prev.canRedo === canRedo ? prev : { ...prev, canUndo, canRedo }));
    } catch {
      // Swallow errors caused by optional command processor implementations.
    }
  }, [client, setState]);

  useEffect(() => {
    const handler = () => { void refreshUndoRedo(); };
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
        subscriptionId = await subscriptionAPI.subscribeUndoState((event: UndoStateEvent) => {
          if (!isActive) return;
          const { canUndo, canRedo } = event;
          subscriptionEstablishedRef.current = true;
          setState((prev) => (prev.canUndo === canUndo && prev.canRedo === canRedo ? prev : { ...prev, canUndo, canRedo }));
          setSSOT({ canUndo, canRedo });
        });
      } catch (error) {
        console.warn('[useCommandProcessorTracker] undo-state subscription failed', error);
      }
    };

    void attach();

    return () => {
      isActive = false;
      if (subscriptionId && subscriptionAPI) {
        void subscriptionAPI.unsubscribe(subscriptionId).catch(() => {});
      } else if (subscriptionId) {
        void client.getSubscriptionAPI().then((api) => api.unsubscribe(subscriptionId!)).catch(() => {});
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
        setState((prev) => (prev.canUndo === canUndo && prev.canRedo === canRedo ? prev : { ...prev, canUndo, canRedo }));
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
