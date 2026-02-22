import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import type { NodeId } from '@hierarchidb/core-types';

type UseShapeBuildSessionRecordArgs = {
  activeNodeId: NodeId | null;
};

type UseShapeBuildSessionRecordResult = {
  sessionRecord: ShapeBuildSessionRecord | null;
  refreshSessionRecord: () => Promise<ShapeBuildSessionRecord | null>;
  updateSessionRecord: (patch: Partial<ShapeBuildSessionRecord>) => Promise<boolean>;
};

export const useShapeBuildSessionRecord = ({
  activeNodeId,
}: UseShapeBuildSessionRecordArgs): UseShapeBuildSessionRecordResult => {
  const [sessionRecord, setSessionRecord] = useState<ShapeBuildSessionRecord | null>(null);
  const lastWorkerStageTraceKeyRef = useRef<string | null>(null);

  const refreshSessionRecord = useCallback(async () => {
    if (!activeNodeId) {
      setSessionRecord(null);
      return null;
    }
    const next = await shapeQueryAPIImpl.getBuildSessionRecord(activeNodeId).catch(() => null);
    setSessionRecord(next);
    return next;
  }, [activeNodeId]);

  const updateSessionRecord = useCallback(async (patch: Partial<ShapeBuildSessionRecord>): Promise<boolean> => {
    if (!activeNodeId) return false;
    if (Object.keys(patch).length === 0) return true;
    try {
      await shapeMutationAPIImpl.updateBuildSession(activeNodeId, patch);
      setSessionRecord((current) => {
        if (!current) return current;
        return {
          ...current,
          ...patch,
          updatedAt: Date.now(),
        };
      });
      return true;
    } catch (error) {
      console.warn('[ShapeBuildProgressStep] failed to update build session record', error);
      return false;
    }
  }, [activeNodeId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      await refreshSessionRecord();
      if (cancelled) return;
    };
    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [refreshSessionRecord]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const activeNodeIdText = activeNodeId ? String(activeNodeId) : null;
    const stageId = sessionRecord?.stageId ?? null;
    const status = sessionRecord?.status ?? null;
    const stageHeartbeatAt = sessionRecord?.stageHeartbeatAt ?? null;
    const updatedAt = sessionRecord?.updatedAt ?? null;
    const key = `${activeNodeIdText ?? '-'}:${status ?? '-'}:${stageId ?? '-'}:${stageHeartbeatAt ?? '-'}`;
    if (lastWorkerStageTraceKeyRef.current === key) return;
    lastWorkerStageTraceKeyRef.current = key;
    if (!activeNodeIdText) return;
    console.log('[ShapeBuildWorkerStageTrace]', {
      nodeId: activeNodeIdText,
      status,
      stageId,
      stageHeartbeatAt,
      updatedAt,
    });
  }, [
    activeNodeId,
    sessionRecord?.stageHeartbeatAt,
    sessionRecord?.stageId,
    sessionRecord?.status,
    sessionRecord?.updatedAt,
  ]);

  return {
    sessionRecord,
    refreshSessionRecord,
    updateSessionRecord,
  };
};
