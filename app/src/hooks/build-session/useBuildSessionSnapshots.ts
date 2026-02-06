import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { proxy } from 'comlink';
import { useSessionCoordinator } from '@hierarchidb/ui-session-coordinator';
import { useWorker } from '~/contexts/WorkerProvider.js';

export type BuildSessionSnapshot = {
  nodeId: NodeId;
  status?: unknown;
  progress?: unknown;
  updatedAt?: number;
  lastSeenAt?: number;
  hasShapeRecord?: boolean;
};

export type BuildSessionSnapshotsResult = {
  sessions: BuildSessionSnapshot[];
  isRunnerTab: boolean;
  activeSessionId: string | null;
  tabId: string;
};

const buildSessionSignature = (sessions: BuildSessionSnapshot[]): string => {
  return sessions
    .map((session) => {
      const status = typeof session.status === 'string' ? session.status : '';
      const updatedAt = session.updatedAt ?? '';
      const lastSeenAt = session.lastSeenAt ?? '';
      const progressKey = (() => {
        if (session.progress === null || session.progress === undefined) return '';
        if (typeof session.progress === 'string' || typeof session.progress === 'number') {
          return String(session.progress);
        }
        try {
          return JSON.stringify(session.progress);
        } catch {
          return '';
        }
      })();
      return `${session.nodeId}|${status}|${updatedAt}|${lastSeenAt}|${progressKey}`;
    })
    .join('||');
};

export const useBuildSessionSnapshots = (nodeType: NodeType): BuildSessionSnapshotsResult => {
  const { client: workerClient, initialize, isInitialized } = useWorker();
  const coordinator = useSessionCoordinator();
  const [sessions, setSessions] = useState<BuildSessionSnapshot[]>([]);
  const sessionMapRef = useRef<Map<string, BuildSessionSnapshot>>(new Map());
  const signatureRef = useRef('');
  const [isRunnerTab, setIsRunnerTab] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const tabIdRef = useRef<string>(coordinator.getTabId());
  const initRequestedRef = useRef(false);

  useEffect(() => {
    if (workerClient || isInitialized || initRequestedRef.current) return;
    initRequestedRef.current = true;
    void initialize().catch((error: unknown) => {
      initRequestedRef.current = false;
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[useBuildSessionSnapshots] worker initialize failed', message);
    });
  }, [initialize, isInitialized, workerClient]);

  const updateSessions = useCallback((nextMap: Map<string, BuildSessionSnapshot>) => {
    const nextSessions = Array.from(nextMap.values()).sort((a, b) => {
      return String(a.nodeId).localeCompare(String(b.nodeId));
    });
    const signature = buildSessionSignature(nextSessions);
    if (signature === signatureRef.current) return;
    signatureRef.current = signature;
    setSessions(nextSessions);
  }, []);

  useEffect(() => {
    if (!workerClient) {
      sessionMapRef.current = new Map();
      updateSessions(new Map());
      return;
    }
    let active = true;
    let unsubscribe: (() => void) | null = null;
    const subscribe = async () => {
      const unsub = await workerClient.subscribeBuildSessionRecordsByStatus(
        nodeType,
        ['running'],
        proxy(async (incoming) => {
          if (!active) return;
          const nextMap = new Map(sessionMapRef.current);
          const activeIds = new Set<string>();
          incoming.forEach((session) => {
            const key = String(session.nodeId);
            activeIds.add(key);
            const existing = nextMap.get(key);
            nextMap.set(key, {
              nodeId: session.nodeId,
              status: session.status,
              progress: session.progress,
              updatedAt: session.updatedAt,
              lastSeenAt: existing?.lastSeenAt,
              hasShapeRecord: true,
            });
          });
          for (const [key, snapshot] of nextMap.entries()) {
            if (snapshot.hasShapeRecord && !activeIds.has(key)) {
              if (snapshot.lastSeenAt) {
                nextMap.set(key, { ...snapshot, hasShapeRecord: false });
              } else {
                nextMap.delete(key);
              }
            }
          }
          sessionMapRef.current = nextMap;
          updateSessions(nextMap);
        })
      );
      unsubscribe = () => {
        if (typeof unsub === 'function') {
          unsub();
        }
      };
    };
    void subscribe();
    return () => {
      active = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [nodeType, updateSessions, workerClient]);

  const sendAck = useCallback(
    (sessionId: string, receivedTabId: string) => {
      const channel = channelRef.current;
      if (!channel) return;
      coordinator.sendAck(channel, sessionId, receivedTabId);
    },
    [coordinator]
  );

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = coordinator.openChannel();
    channelRef.current = channel;
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!coordinator.isSessionChannelMessage(message)) return;
      const isSameTab = message.tabId === tabIdRef.current;
      if (message.type === 'broadcast') {
        const now = Date.now();
        const key = String(message.sessionId);
        const existing = sessionMapRef.current.get(key);
        const next: BuildSessionSnapshot = {
          nodeId: message.sessionId as NodeId,
          status: message.status ?? existing?.status,
          progress: message.progress ?? existing?.progress,
          updatedAt: message.timestamp ?? now,
          lastSeenAt: now,
          hasShapeRecord: existing?.hasShapeRecord,
        };
        const nextMap = new Map(sessionMapRef.current);
        nextMap.set(key, next);
        sessionMapRef.current = nextMap;
        updateSessions(nextMap);
        if (isSameTab) return;
      }
      if (isSameTab) return;
      sendAck(message.sessionId, message.tabId);
    };
    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, [coordinator, sendAck, updateSessions]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = channelRef.current;
    if (!channel) return;
    if (sessions.length === 0) return;
    const tick = () => {
      const now = Date.now();
      sessions.forEach((session) => {
        coordinator.sendPoll(channel, String(session.nodeId), now);
      });
    };
    tick();
    const intervalId = setInterval(tick, coordinator.pollIntervalTimeout);
    return () => {
      clearInterval(intervalId);
    };
  }, [coordinator, sessions]);

  useEffect(() => {
    const staleTimeout = coordinator.quietThresholdTimeout + coordinator.pollIntervalTimeout * 2;
    const intervalId = setInterval(() => {
      const now = Date.now();
      const nextMap = new Map(sessionMapRef.current);
      let changed = false;
      nextMap.forEach((snapshot, key) => {
        if (snapshot.hasShapeRecord) return;
        if (!snapshot.lastSeenAt) return;
        if (now - snapshot.lastSeenAt > staleTimeout) {
          nextMap.delete(key);
          changed = true;
        }
      });
      if (changed) {
        sessionMapRef.current = nextMap;
        updateSessions(nextMap);
      }
    }, 1000);
    return () => {
      clearInterval(intervalId);
    };
  }, [coordinator.pollIntervalTimeout, coordinator.quietThresholdTimeout, updateSessions]);

  useEffect(() => {
    const updateRunner = () => {
      const now = Date.now();
      setIsRunnerTab(coordinator.isRunnerTab(now));
    };
    updateRunner();
    const intervalId = setInterval(updateRunner, 1000);
    return () => {
      clearInterval(intervalId);
    };
  }, [coordinator]);

  const activeSessionId = coordinator.readActiveSessionId();

  return useMemo(() => ({
    sessions,
    isRunnerTab,
    activeSessionId,
    tabId: tabIdRef.current,
  }), [activeSessionId, isRunnerTab, sessions]);
};
