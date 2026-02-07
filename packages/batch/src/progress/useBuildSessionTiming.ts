import { useEffect, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
export type BuildStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export type BuildSessionTimingRecord = {
  startedAt?: number;
  lastHeartbeatAt?: number;
  inactiveMs?: number;
  stageId?: string | null;
  stageStartedAt?: number;
  stageHeartbeatAt?: number;
  stageInactiveMs?: number;
};

export type BuildSessionTimingSnapshot = {
  totalMs: number;
  stageMs: number;
};

export type UseBuildSessionTimingArgs<TSession extends BuildSessionTimingRecord> = {
  buildStatus: BuildStatus;
  resolvedTaskType?: string;
  sessionId?: NodeId;
  getSessionRecord: (sessionId: NodeId) => Promise<TSession | null>;
  updateSession: (sessionId: NodeId, patch: Partial<TSession>) => Promise<void>;
  canWrite: boolean;
  heartbeatIntervalMs?: number;
  heartbeatPersistMs?: number;
  inactiveGraceMs?: number;
};

const DEFAULT_HEARTBEAT_INTERVAL_MS = 1000;
const DEFAULT_HEARTBEAT_PERSIST_MS = 5000;
const DEFAULT_INACTIVE_GRACE_MS = 5000;

const computeInactiveDelta = (deltaMs: number, heartbeatIntervalMs: number, inactiveGraceMs: number): number => {
  const gap = deltaMs - heartbeatIntervalMs;
  return gap > inactiveGraceMs ? gap : 0;
};

const computeTimingSnapshot = (
  session: BuildSessionTimingRecord | null,
  now: number,
  buildStatus: BuildStatus,
  resolvedTaskType?: string,
): BuildSessionTimingSnapshot => {
  if (!session?.startedAt) {
    return { totalMs: 0, stageMs: 0 };
  }
  const baseTime = buildStatus === 'running'
    ? now
    : session.lastHeartbeatAt ?? now;
  const totalMs = Math.max(0, baseTime - session.startedAt - (session.inactiveMs ?? 0));
  if (!session.stageId || !session.stageStartedAt || session.stageId !== resolvedTaskType) {
    return { totalMs, stageMs: 0 };
  }
  const stageBaseTime = buildStatus === 'running'
    ? now
    : session.stageHeartbeatAt ?? session.lastHeartbeatAt ?? now;
  const stageMs = Math.max(
    0,
    stageBaseTime - session.stageStartedAt - (session.stageInactiveMs ?? 0),
  );
  return { totalMs, stageMs };
};

export const useBuildSessionTiming = <TSession extends BuildSessionTimingRecord>({
  buildStatus,
  resolvedTaskType,
  sessionId,
  getSessionRecord,
  updateSession,
  canWrite,
  heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
  heartbeatPersistMs = DEFAULT_HEARTBEAT_PERSIST_MS,
  inactiveGraceMs = DEFAULT_INACTIVE_GRACE_MS,
}: UseBuildSessionTimingArgs<TSession>) => {
  const [timingSnapshot, setTimingSnapshot] = useState<BuildSessionTimingSnapshot>({ totalMs: 0, stageMs: 0 });
  const sessionRef = useRef<TSession | null>(null);
  const lastPersistedHeartbeatAtRef = useRef<number | null>(null);
  const lastBuildStatusRef = useRef<BuildStatus | null>(buildStatus);

  const applySessionPatch = async (patch: Partial<TSession>): Promise<void> => {
    if (!canWrite) return;
    if (!sessionId) return;
    const session = sessionRef.current;
    if (!session) return;
    if (Object.keys(patch).length === 0) return;
    const next = { ...session, ...patch };
    sessionRef.current = next;
    if (typeof patch.lastHeartbeatAt === 'number') {
      lastPersistedHeartbeatAtRef.current = patch.lastHeartbeatAt;
    }
    await updateSession(sessionId, patch);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!sessionId) {
        sessionRef.current = null;
        setTimingSnapshot({ totalMs: 0, stageMs: 0 });
        return;
      }
      const session = await getSessionRecord(sessionId);
      if (cancelled) return;
      sessionRef.current = session;
      lastPersistedHeartbeatAtRef.current = session?.lastHeartbeatAt ?? null;
      setTimingSnapshot(computeTimingSnapshot(session, Date.now(), buildStatus, resolvedTaskType));
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [buildStatus, getSessionRecord, resolvedTaskType, sessionId]);

  useEffect(() => {
    if (!canWrite) return;
    const session = sessionRef.current;
    if (!session || buildStatus !== 'running') return;
    if (!resolvedTaskType) return;
    const now = Date.now();
    const patch: Partial<TSession> = {};
    if (!session.lastHeartbeatAt) {
      patch.lastHeartbeatAt = now;
    }
    if (session.stageId !== resolvedTaskType) {
      patch.stageId = resolvedTaskType;
      patch.stageStartedAt = now;
      patch.stageInactiveMs = 0;
      patch.stageHeartbeatAt = now;
    } else {
      if (!session.stageStartedAt) {
        patch.stageStartedAt = now;
      }
      if (!session.stageHeartbeatAt) {
        patch.stageHeartbeatAt = now;
      }
    }
    if (Object.keys(patch).length === 0) return;
    void applySessionPatch(patch).then(() => {
      const next = sessionRef.current;
      setTimingSnapshot(computeTimingSnapshot(next, now, buildStatus, resolvedTaskType));
    });
  }, [applySessionPatch, buildStatus, canWrite, resolvedTaskType]);

  useEffect(() => {
    if (!canWrite) return;
    const previous = lastBuildStatusRef.current;
    lastBuildStatusRef.current = buildStatus;
    if (previous !== 'running' || buildStatus === 'running') return;
    const session = sessionRef.current;
    if (!session) return;
    const now = Date.now();
    const patch: Partial<TSession> = {};
    patch.lastHeartbeatAt = now;
    if (session.stageId && session.stageId === resolvedTaskType) {
      patch.stageHeartbeatAt = now;
    }
    void applySessionPatch(patch).then(() => {
      const next = sessionRef.current;
      setTimingSnapshot(computeTimingSnapshot(next, now, buildStatus, resolvedTaskType));
    });
  }, [applySessionPatch, buildStatus, canWrite, resolvedTaskType]);

  useEffect(() => {
    if (buildStatus !== 'running') return;
    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const session = sessionRef.current;
      if (!session) {
        setTimingSnapshot({ totalMs: 0, stageMs: 0 });
        return;
      }
      if (!canWrite) {
        setTimingSnapshot(computeTimingSnapshot(session, now, buildStatus, resolvedTaskType));
        return;
      }
      const lastHeartbeatAt = session.lastHeartbeatAt ?? now;
      const inactiveDelta = computeInactiveDelta(now - lastHeartbeatAt, heartbeatIntervalMs, inactiveGraceMs);
      const stageApplies = session.stageId && session.stageId === resolvedTaskType;
      const stageHeartbeatAt = stageApplies
        ? session.stageHeartbeatAt ?? lastHeartbeatAt
        : null;
      const stageInactiveDelta = stageApplies && stageHeartbeatAt
        ? computeInactiveDelta(now - stageHeartbeatAt, heartbeatIntervalMs, inactiveGraceMs)
        : 0;
      const patch: Partial<TSession> = {};
      if (inactiveDelta > 0) {
        patch.inactiveMs = (session.inactiveMs ?? 0) + inactiveDelta;
        patch.lastHeartbeatAt = now;
      }
      if (stageApplies && stageInactiveDelta > 0) {
        patch.stageInactiveMs = (session.stageInactiveMs ?? 0) + stageInactiveDelta;
        patch.stageHeartbeatAt = now;
      }
      const shouldPersistHeartbeat = (
        typeof lastPersistedHeartbeatAtRef.current !== 'number'
        || now - lastPersistedHeartbeatAtRef.current >= heartbeatPersistMs
      );
      if (Object.keys(patch).length === 0 && shouldPersistHeartbeat) {
        patch.lastHeartbeatAt = now;
        if (stageApplies) {
          patch.stageHeartbeatAt = now;
        }
      }
      if (Object.keys(patch).length > 0) {
        void applySessionPatch(patch).then(() => {
          const next = sessionRef.current;
          setTimingSnapshot(computeTimingSnapshot(next, now, buildStatus, resolvedTaskType));
        });
        return;
      }
      setTimingSnapshot(computeTimingSnapshot(session, now, buildStatus, resolvedTaskType));
    }, heartbeatIntervalMs);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    applySessionPatch,
    buildStatus,
    canWrite,
    heartbeatIntervalMs,
    heartbeatPersistMs,
    inactiveGraceMs,
    resolvedTaskType,
  ]);

  return {
    timingSnapshot,
    session: sessionRef.current,
  };
};
