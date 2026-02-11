import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { createSessionCoordinator } from '@hierarchidb/session-coordinator';
import { proxy } from 'comlink';
import { useWorkerAPI } from '@hierarchidb/ui-worker-provider';

type BuildSessionRecordLike = {
  nodeId: NodeId;
  status?: unknown;
  progress?: unknown;
  updatedAt?: number;
};

export type BuildSessionSnapshot = {
  nodeId: NodeId;
  status?: unknown;
  progress?: unknown;
  updatedAt?: number;
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
      return `${session.nodeId}|${status}|${updatedAt}|${progressKey}`;
    })
    .join('||');
};

export const useBuildSessionSnapshots = (nodeType: NodeType): BuildSessionSnapshotsResult => {
  const { api, initialize, loading } = useWorkerAPI();
  const coordinator = useMemo(() => (
    createSessionCoordinator({
      channelName: 'sessions',
      pollIntervalTimeout: 3000,
      quietThresholdTimeout: 5000,
    })
  ), []);
  const [sessions, setSessions] = useState<BuildSessionSnapshot[]>([]);
  const sessionMapRef = useRef<Map<string, BuildSessionSnapshot>>(new Map());
  const signatureRef = useRef('');
  const [isRunnerTab, setIsRunnerTab] = useState(false);
  const tabIdRef = useRef<string>(coordinator.getTabId());
  const initRequestedRef = useRef(false);

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
          const nextMap = new Map<string, BuildSessionSnapshot>();
          incoming.forEach((session: BuildSessionRecordLike) => {
            const key = String(session.nodeId);
            nextMap.set(key, {
              nodeId: session.nodeId,
              status: session.status,
              progress: session.progress,
              updatedAt: session.updatedAt,
            });
          });
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
