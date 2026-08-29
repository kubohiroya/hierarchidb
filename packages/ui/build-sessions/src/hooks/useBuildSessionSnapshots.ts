import {
  activeBuildSessionRuntimeStatuses,
  type BuildSessionRuntimeRecord,
} from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { WorkerAPI } from '@hierarchidb/worker-api';
import type { Remote } from 'comlink';
import { proxy } from 'comlink';
import { useEffect, useMemo, useState } from 'react';
import { sanitizeForComlink } from '../utils/comlinkSanitizer.js';
import { useWorkerQueryAPI } from './useWorkerQueryAPI.js';

export type BuildSessionSnapshot = {
  nodeId: NodeId;
  status: BuildSessionRuntimeRecord['status'];
  progress?: BuildSessionRuntimeRecord['progress'];
  lastHeartbeatAt?: number;
  startedAt?: number;
  completedAt?: number;
  isActive: boolean;
  revision: number;
};

export type BuildSessionSnapshotsResult = {
  sessions: BuildSessionSnapshot[];
};

const IN_PROGRESS_STATUSES: BuildSessionRuntimeRecord['status'][] = [
  ...activeBuildSessionRuntimeStatuses,
];

const buildSessionSignature = (sessions: BuildSessionSnapshot[]): string => {
  return sessions
    .map((session) => {
      const lastHeartbeatAt = session.lastHeartbeatAt ?? '';
      const startedAt = session.startedAt ?? '';
      const completedAt = session.completedAt ?? '';
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
      return `${session.nodeId}|${session.status}|${session.isActive ? 1 : 0}|${session.revision}|${lastHeartbeatAt}|${startedAt}|${completedAt}|${progressKey}`;
    })
    .join('||');
};

type WorkerPayload = Record<string, unknown>;
type WorkerApi = WorkerAPI<WorkerPayload>;
type WorkerApiRemote = Remote<WorkerApi>;
type BuildSessionListener = (sessions: BuildSessionSnapshot[]) => void;

class SharedBuildSessionSubscription {
  private readonly listeners = new Set<BuildSessionListener>();
  private sessions: BuildSessionSnapshot[] = [];
  private signature = '';
  private unsubscribe: (() => void) | null = null;
  private subscribeRequested = false;
  private disposed = false;
  private cleanedUp = false;

  constructor(
    private readonly api: WorkerApiRemote,
    private readonly nodeType: NodeType,
    private readonly cleanup: () => void
  ) {}

  addListener(listener: BuildSessionListener): () => void {
    this.listeners.add(listener);
    listener(this.sessions);
    this.ensureSubscribed();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.disposeAndCleanup();
      }
    };
  }

  private ensureSubscribed() {
    if (this.subscribeRequested || this.disposed) {
      return;
    }
    this.subscribeRequested = true;
    void this.start();
  }

  private async start() {
    try {
      const unsubscribe = await this.api.subscribeBuildSessionRuntimes(
        this.nodeType,
        { statuses: IN_PROGRESS_STATUSES },
        proxy((incoming: BuildSessionRuntimeRecord[]) => {
          const safeIncoming = sanitizeForComlink(incoming);
          this.handleIncoming(safeIncoming);
        })
      );
      if (this.disposed) {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
        return;
      }
      this.unsubscribe = typeof unsubscribe === 'function' ? unsubscribe : null;
    } catch (error) {
      if (!this.disposed) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[useBuildSessionSnapshots] subscribe failed', message);
      }
      this.subscribeRequested = false;
    }
  }

  private handleIncoming(incoming: BuildSessionRuntimeRecord[]) {
    if (this.disposed) {
      return;
    }
    const nextSessions = incoming
      .map((session) => ({
        nodeId: session.nodeId,
        status: session.status,
        progress: session.progress,
        lastHeartbeatAt: session.lastHeartbeatAt,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
        isActive: session.isActive,
        revision: session.revision,
      }))
      .sort((a, b) => String(a.nodeId).localeCompare(String(b.nodeId)));
    const signature = buildSessionSignature(nextSessions);
    if (signature === this.signature) {
      return;
    }
    this.signature = signature;
    this.sessions = nextSessions;
    for (const listener of this.listeners) {
      listener(nextSessions);
    }
  }

  private disposeAndCleanup() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.listeners.clear();
    this.sessions = [];
    this.signature = '';
    if (!this.cleanedUp) {
      this.cleanedUp = true;
      this.cleanup();
    }
  }
}

const sharedSubscriptionsByApi = new WeakMap<object, Map<string, SharedBuildSessionSubscription>>();

const getSharedBuildSessionSubscription = (
  api: WorkerApiRemote,
  nodeType: NodeType
): SharedBuildSessionSubscription => {
  const apiKey = api as object;
  let subscriptionsByNodeType = sharedSubscriptionsByApi.get(apiKey);
  if (!subscriptionsByNodeType) {
    subscriptionsByNodeType = new Map<string, SharedBuildSessionSubscription>();
    sharedSubscriptionsByApi.set(apiKey, subscriptionsByNodeType);
  }
  const nodeTypeKey = String(nodeType);
  const existing = subscriptionsByNodeType.get(nodeTypeKey);
  if (existing) {
    return existing;
  }
  const created = new SharedBuildSessionSubscription(api, nodeType, () => {
    const latest = sharedSubscriptionsByApi.get(apiKey);
    if (!latest) {
      return;
    }
    latest.delete(nodeTypeKey);
    if (latest.size === 0) {
      sharedSubscriptionsByApi.delete(apiKey);
    }
  });
  subscriptionsByNodeType.set(nodeTypeKey, created);
  return created;
};

export const useBuildSessionSnapshots = (nodeType: NodeType): BuildSessionSnapshotsResult => {
  const { api } = useWorkerQueryAPI();
  const [sessions, setSessions] = useState<BuildSessionSnapshot[]>([]);

  useEffect(() => {
    if (!api) {
      setSessions([]);
      return;
    }
    const sharedSubscription = getSharedBuildSessionSubscription(api, nodeType);
    return sharedSubscription.addListener(setSessions);
  }, [api, nodeType]);

  return useMemo(() => ({ sessions }), [sessions]);
};
