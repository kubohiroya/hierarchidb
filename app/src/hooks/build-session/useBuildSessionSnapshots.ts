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
  const tabIdRef = useRef<string>(coordinator.getTabId());
  const initRequestedRef = useRef(false);
  const lastPruneAtRef = useRef<number | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const now = Date.now();
      const sessionIds = Array.from(sessionMapRef.current.keys());
      if (sessionIds.length === 0) return;
      const records = await Promise.all(sessionIds.map((id) => (
        coordinator.readHeartbeat(id)
      )));
      if (cancelled) return;
      const nextMap = new Map(sessionMapRef.current);
      let changed = false;
      sessionIds.forEach((id, index) => {
        const existing = nextMap.get(id);
        if (!existing) return;
        const record = records[index];
        if (!record) {
          if (!existing.hasShapeRecord && existing.lastSeenAt) {
            nextMap.delete(id);
            changed = true;
          }
          return;
        }
        const isExpired = record.expiresAt <= now;
        if (isExpired && !existing.hasShapeRecord) {
          nextMap.delete(id);
          changed = true;
          return;
        }
        const nextUpdatedAt = Math.max(existing.updatedAt ?? 0, record.updatedAt ?? 0) || existing.updatedAt || record.updatedAt;
        const next: BuildSessionSnapshot = {
          ...existing,
          status: record.status ?? existing.status,
          progress: record.progress ?? existing.progress,
          updatedAt: nextUpdatedAt,
          lastSeenAt: record.updatedAt,
        };
        nextMap.set(id, next);
        changed = true;
      });
      if (changed) {
        sessionMapRef.current = nextMap;
        updateSessions(nextMap);
      }
      if (!lastPruneAtRef.current || now - lastPruneAtRef.current > coordinator.quietThresholdTimeout) {
        lastPruneAtRef.current = now;
        void coordinator.pruneHeartbeats(now);
      }
    };
    void tick();
    const intervalId = setInterval(() => {
      void tick();
    }, coordinator.pollIntervalTimeout);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [coordinator, updateSessions]);

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
