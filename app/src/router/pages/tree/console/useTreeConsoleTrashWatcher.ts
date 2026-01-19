import type { WorkerAPI } from '@hierarchidb/common-api';
import type { NodeId, TreeId } from '@hierarchidb/common-types';
import type { Remote } from 'comlink';
import { proxy as comlinkProxy } from 'comlink';
import { useEffect, useRef, useState } from 'react';
import { type SubscriptionCallback, Subscriptions } from '~/hooks/SubscriptionServices.ts';
import { isSubscriptionDebug, logIntegrationWarning } from './treeConsoleIntegrationUtils.js';

export type TrashWatcherState = {
  hasTrashItems: boolean;
  trashRootIdRef: React.MutableRefObject<NodeId | null>;
};

export function useTreeConsoleTrashWatcher({
  client,
  treeId,
}: {
  client?: Remote<WorkerAPI>;
  treeId?: string;
}): TrashWatcherState {
  const [hasTrashItems, setHasTrashItems] = useState(false);
  const trashRootIdRef = useRef<NodeId | null>(null);
  const trashSubRef = useRef<string | null>(null);
  const trashCallbackRef = useRef<SubscriptionCallback | null>(null);
  const trashRefreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const checkTrashItems = async () => {
      if (client && treeId) {
        const queryAPI = await client.getQueryAPI();
        const tree = await queryAPI.getTree(treeId as TreeId);
        if (tree?.trashRootId) {
          const trashNodeId = tree.trashRootId as NodeId;
          trashRootIdRef.current = trashNodeId;
          const trashChildren = await queryAPI.listChildren(trashNodeId);
          setHasTrashItems(trashChildren.length > 0);
        } else {
          trashRootIdRef.current = null;
          setHasTrashItems(false);
        }
      }
    };
    void checkTrashItems();
  }, [client, treeId]);

  useEffect(() => {
    let disposed = false;
    const setup = async () => {
      if (!client || !treeId) return;
      try {
        const queryAPI = await client.getQueryAPI();
        await client.getSubscriptionAPI();
        const tree = await queryAPI.getTree(treeId as TreeId);
        const nextTrashRootId = tree?.trashRootId;
        if (!nextTrashRootId) {
          trashRootIdRef.current = null;
          setHasTrashItems(false);
          return;
        }
        trashRootIdRef.current = nextTrashRootId as NodeId;

        if (trashSubRef.current && typeof nextTrashRootId === 'string') {
          if (isSubscriptionDebug()) {
            console.log('[Subscription][trash] already active', {
              trashRootId: nextTrashRootId,
              subId: trashSubRef.current,
            });
          }
        }

        const requestRefresh = () => {
          if (disposed) return;
          if (trashRefreshTimerRef.current !== null) return;
          trashRefreshTimerRef.current = window.setTimeout(async () => {
            trashRefreshTimerRef.current = null;
            try {
              const children = await queryAPI.listChildren(nextTrashRootId);
              setHasTrashItems((children?.length || 0) > 0);
            } catch (error) {
              logIntegrationWarning('Failed to refresh trash children', error);
            }
          }, 80);
        };

        requestRefresh();

        const cb = comlinkProxy((ev: unknown) => {
          if (isSubscriptionDebug()) {
            console.log('[Subscription][trash] event', ev);
          }
          requestRefresh();
        });
        trashCallbackRef.current = cb;
        const existing = Subscriptions.getActive('trash', nextTrashRootId);
        if (existing) return;
        const { subId: sid, created } = await Subscriptions.subscribe(
          'trash',
          client,
          nextTrashRootId,
          cb
        );
        if (created && isSubscriptionDebug()) {
          console.log('[Subscription][trash] subscribed', {
            trashRootId: nextTrashRootId,
            subId: sid,
          });
        }
        if (disposed) {
          await Subscriptions.release('trash', client, nextTrashRootId);
          return;
        }
        trashSubRef.current = sid ?? null;
      } catch (error) {
        logIntegrationWarning('Failed to initialize trash subscription workflow', error);
      }
    };

    void setup();
    return () => {
      disposed = true;
      if (trashRefreshTimerRef.current !== null) {
        window.clearTimeout(trashRefreshTimerRef.current);
        trashRefreshTimerRef.current = null;
      }
      const cleanup = async () => {
        try {
          const queryAPI = await client?.getQueryAPI();
          const tree = await queryAPI?.getTree(treeId as TreeId);
          const nextTrashRootId = tree?.trashRootId;
          if (nextTrashRootId && client) {
            await Subscriptions.release('trash', client, nextTrashRootId);
          }
        } catch (error) {
          logIntegrationWarning('Failed to release trash subscription', error);
        }
        trashSubRef.current = null;
        trashCallbackRef.current = null;
      };
      void cleanup();
    };
  }, [client, treeId]);

  return { hasTrashItems, trashRootIdRef };
}
