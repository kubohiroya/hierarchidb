import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { HeartbeatRecord } from '@hierarchidb/session-coordinator';
import { proxy } from 'comlink';
import { useSessionCoordinator } from '@hierarchidb/ui-session-coordinator';
import { useWorkerAPI } from '@hierarchidb/ui-worker-provider';

type QueuedProgress = {
  requestedAt?: number;
};

type BuildSessionRecordLike = {
  nodeId: NodeId;
  status?: unknown;
  progress?: unknown;
  updatedAt?: number;
  startedAt?: number;
};

export type BuildSessionSnapshot = {
  nodeId: NodeId;
  status?: unknown;
  progress?: unknown;
  updatedAt?: number;
  lastSeenAt?: number;
  hasShapeRecord?: boolean;
  requestedAt?: number;
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
      const requestedAt = session.requestedAt ?? '';
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
      return `${session.nodeId}|${status}|${updatedAt}|${lastSeenAt}|${requestedAt}|${progressKey}`;
    })
    .join('||');
};

const resolveQueuedRequestedAt = (progress: unknown, fallback?: number): number | undefined => {
  if (!progress || typeof progress !== 'object') return fallback;
  const record = progress as QueuedProgress;
  if (typeof record.requestedAt === 'number') return record.requestedAt;
  return fallback;
};

export const useBuildSessionSnapshots = (nodeType: NodeType): BuildSessionSnapshotsResult => {
  const { api, initialize, loading } = useWorkerAPI();
  const coordinator = useSessionCoordinator();
  const [sessions, setSessions] = useState<BuildSessionSnapshot[]>([]);
  const sessionMapRef = useRef<Map<string, BuildSessionSnapshot>>(new Map());
  const signatureRef = useRef('');
  const [isRunnerTab, setIsRunnerTab] = useState(false);
  const tabIdRef = useRef<string>(coordinator.getTabId());
  const initRequestedRef = useRef(false);
  const lastPruneAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (api || loading || initRequestedRef.current) return;
    initRequestedRef.current = true;
    void initialize().catch((error: unknown) => {
      initRequestedRef.current = false;
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[useBuildSessionSnapshots] worker initialize failed', message);
    });
  }, [api, initialize, loading]);

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
    if (!api) {
      sessionMapRef.current = new Map();
      updateSessions(new Map());
      return;
    }
    let active = true;
    let unsubscribe: (() => void) | null = null;
    const subscribe = async () => {
      const unsub = await api.subscribeBuildSessionRecordsByStatus(
        nodeType,
        ['running'],
        proxy(async (incoming: BuildSessionRecordLike[]) => {
          if (!active) return;
          const nextMap = new Map(sessionMapRef.current);
          const activeIds = new Set<string>();
          incoming.forEach((session: BuildSessionRecordLike) => {
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
              requestedAt: session.startedAt ?? existing?.requestedAt ?? session.updatedAt,
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
  }, [api, nodeType, updateSessions]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const now = Date.now();
      const heartbeats = await coordinator.readHeartbeats();
      if (cancelled) return;
      const nextMap = new Map(sessionMapRef.current);
      let changed = false;

      heartbeats.forEach((record: HeartbeatRecord) => {
        if (!record || record.expiresAt <= now) return;
        const key = String(record.sessionId);
        const existing = nextMap.get(key);
        if (existing?.hasShapeRecord) {
          const nextUpdatedAt = Math.max(existing.updatedAt ?? 0, record.updatedAt ?? 0) || existing.updatedAt || record.updatedAt;
          const next: BuildSessionSnapshot = {
            ...existing,
            updatedAt: nextUpdatedAt,
            lastSeenAt: record.updatedAt,
            status: record.status ?? existing.status,
            progress: record.progress ?? existing.progress,
            requestedAt: existing.requestedAt ?? resolveQueuedRequestedAt(record.progress, record.updatedAt),
          };
          nextMap.set(key, next);
          changed = true;
          return;
        }
        if (record.status !== 'waiting') return;
        const requestedAt = resolveQueuedRequestedAt(record.progress, record.updatedAt) ?? record.updatedAt;
        const next: BuildSessionSnapshot = {
          nodeId: record.sessionId as NodeId,
          status: record.status,
          progress: record.progress,
          updatedAt: record.updatedAt,
          lastSeenAt: record.updatedAt,
          hasShapeRecord: false,
          requestedAt,
        };
        nextMap.set(key, next);
        changed = true;
      });

      for (const [key, snapshot] of nextMap.entries()) {
        if (!snapshot.hasShapeRecord && snapshot.status === 'waiting' && snapshot.lastSeenAt) {
          const expired = snapshot.lastSeenAt + coordinator.quietThresholdTimeout <= now;
          if (expired) {
            nextMap.delete(key);
            changed = true;
          }
        }
      }

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
