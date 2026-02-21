import type { BuildWorkerAPI } from '~/types/worker-api';
import type { NodeId, TreeId } from '@hierarchidb/core-types';
import type { Remote } from 'comlink';
import { proxy as comlinkProxy } from 'comlink';
import { useEffect, useRef, useState } from 'react';
import { type SubscriptionCallback, Subscriptions } from '~/hooks/SubscriptionServices';
import { isSubscriptionDebug, logIntegrationWarning } from '../treeConsoleIntegrationUtils.js';

export type ArchiveWatcherState = {
  hasArchiveItems: boolean;
  archiveRootIdRef: React.MutableRefObject<NodeId | null>;
};

export function useTreeConsoleArchiveWatcher({
  client,
  treeId,
}: {
  client?: Remote<BuildWorkerAPI>;
  treeId?: string;
}): ArchiveWatcherState {
  const [hasArchiveItems, setHasArchiveItems] = useState(false);
  const archiveRootIdRef = useRef<NodeId | null>(null);
  const archiveSubRef = useRef<string | null>(null);
  const archiveCallbackRef = useRef<SubscriptionCallback | null>(null);
  const archiveRefreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const checkArchiveItems = async () => {
      if (client && treeId) {
        const queryAPI = await client.getQueryAPI();
        const tree = await queryAPI.getTree(treeId as TreeId);
        if (tree?.archiveRootId) {
          const archiveNodeId = tree.archiveRootId as NodeId;
          archiveRootIdRef.current = archiveNodeId;
          const archiveChildren = await queryAPI.listChildren(archiveNodeId);
          setHasArchiveItems(archiveChildren.length > 0);
        } else {
          archiveRootIdRef.current = null;
          setHasArchiveItems(false);
        }
      }
    };
    void checkArchiveItems();
  }, [client, treeId]);

  useEffect(() => {
    let disposed = false;
    const setup = async () => {
      if (!client || !treeId) return;
      try {
        const queryAPI = await client.getQueryAPI();
        await client.getSubscriptionAPI();
        const tree = await queryAPI.getTree(treeId as TreeId);
        const nextArchiveRootId = tree?.archiveRootId;
        if (!nextArchiveRootId) {
          archiveRootIdRef.current = null;
          setHasArchiveItems(false);
          return;
        }
        archiveRootIdRef.current = nextArchiveRootId as NodeId;

        if (archiveSubRef.current && typeof nextArchiveRootId === 'string') {
          if (isSubscriptionDebug()) {
            console.log('[Subscription][archive] already active', {
              archiveRootId: nextArchiveRootId,
              subId: archiveSubRef.current,
            });
          }
        }

        const requestRefresh = () => {
          if (disposed) return;
          if (archiveRefreshTimerRef.current !== null) return;
          archiveRefreshTimerRef.current = window.setTimeout(async () => {
            archiveRefreshTimerRef.current = null;
            try {
              const children = await queryAPI.listChildren(nextArchiveRootId);
              setHasArchiveItems((children?.length || 0) > 0);
            } catch (error) {
              logIntegrationWarning('Failed to refresh archive children', error);
            }
          }, 80);
        };

        requestRefresh();

        const cb = comlinkProxy((ev: unknown) => {
          if (isSubscriptionDebug()) {
            console.log('[Subscription][archive] event', ev);
          }
          requestRefresh();
        });
        archiveCallbackRef.current = cb;
        const existing = Subscriptions.getActive('archive', nextArchiveRootId);
        if (existing) return;
        const { subId: sid, created } = await Subscriptions.subscribe(
          'archive',
          client,
          nextArchiveRootId,
          cb
        );
        if (created && isSubscriptionDebug()) {
          console.log('[Subscription][archive] subscribed', {
            archiveRootId: nextArchiveRootId,
            subId: sid,
          });
        }
        if (disposed) {
          await Subscriptions.release('archive', client, nextArchiveRootId);
          return;
        }
        archiveSubRef.current = sid ?? null;
      } catch (error) {
        logIntegrationWarning('Failed to initialize archive subscription workflow', error);
      }
    };

    void setup();
    return () => {
      disposed = true;
      if (archiveRefreshTimerRef.current !== null) {
        window.clearTimeout(archiveRefreshTimerRef.current);
        archiveRefreshTimerRef.current = null;
      }
      const cleanup = async () => {
        try {
          const queryAPI = await client?.getQueryAPI();
          const tree = await queryAPI?.getTree(treeId as TreeId);
          const nextArchiveRootId = tree?.archiveRootId;
          if (nextArchiveRootId && client) {
            await Subscriptions.release('archive', client, nextArchiveRootId);
          }
        } catch (error) {
          logIntegrationWarning('Failed to release archive subscription', error);
        }
        archiveSubRef.current = null;
        archiveCallbackRef.current = null;
      };
      void cleanup();
    };
  }, [client, treeId]);

  return { hasArchiveItems, archiveRootIdRef };
}
