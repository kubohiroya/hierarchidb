import { useEffect, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import type { BuildStatus } from '@hierarchidb/components';
import type { ShapeEntity } from '../../../common/types/index.js';
import {
  appendBuildSample,
  BUILD_MONITOR_SAMPLE_INTERVAL_MS,
  getMemorySnapshot,
  recordBuildFinish,
  recordBuildStart,
} from '@hierarchidb/ui-monitoring';

const buildMonitorConfig = {
  storagePrefix: 'hdb:shape:stage-monitor',
  maxSamples: 3,
  memoryPressureRatio: 0.85,
  heapWarningRatio: 0.85,
  heapCriticalRatio: 0.9,
} as const;

type Args = {
  buildStatus: BuildStatus;
  taskType?: string;
  resolvedTaskType?: string;
  data?: Partial<ShapeEntity>;
  nodeId?: NodeId;
  monitorKey: string | null;
  onChange: (patch: Partial<ShapeEntity>) => void;
};

export const useShapeBuildTiming = ({
  buildStatus,
  taskType,
  resolvedTaskType,
  data,
  nodeId,
  monitorKey,
  onChange,
}: Args) => {
  const lastBuildStartedAtRef = useRef<number | undefined>(data?.buildStartedAt);
  const totalElapsedMsRef = useRef(0);
  const stageElapsedMsRef = useRef(0);
  const lastTickAtRef = useRef<number | null>(null);
  const lastStageIdRef = useRef<string | undefined>(undefined);
  const buildStartRequestedRef = useRef<string | null>(null);
  const [timingSnapshot, setTimingSnapshot] = useState({ totalMs: 0, stageMs: 0 });
  const lastTimingSnapshotRef = useRef({ totalMs: 0, stageMs: 0 });

  useEffect(() => {
    if (lastBuildStartedAtRef.current !== data?.buildStartedAt) {
      lastBuildStartedAtRef.current = data?.buildStartedAt;
      totalElapsedMsRef.current = 0;
      stageElapsedMsRef.current = 0;
      lastTickAtRef.current = null;
      lastStageIdRef.current = resolvedTaskType;
      const next = { totalMs: 0, stageMs: 0 };
      if (lastTimingSnapshotRef.current.totalMs !== next.totalMs || lastTimingSnapshotRef.current.stageMs !== next.stageMs) {
        lastTimingSnapshotRef.current = next;
        setTimingSnapshot(next);
      }
    }
  }, [data?.buildStartedAt, resolvedTaskType]);

  useEffect(() => {
    if (buildStatus !== 'running') {
      buildStartRequestedRef.current = null;
    }
  }, [buildStatus]);

  useEffect(() => {
    if (lastStageIdRef.current !== resolvedTaskType) {
      stageElapsedMsRef.current = 0;
      lastStageIdRef.current = resolvedTaskType;
      if (buildStatus === 'running') {
        lastTickAtRef.current = Date.now();
      }
      setTimingSnapshot((prev) => {
        if (prev.stageMs === 0) return prev;
        const next = { ...prev, stageMs: 0 };
        lastTimingSnapshotRef.current = next;
        return next;
      });
    }
  }, [buildStatus, resolvedTaskType]);

  useEffect(() => {
    if (buildStatus !== 'running') {
      if (lastTickAtRef.current !== null) {
        const now = Date.now();
        const delta = Math.max(0, now - lastTickAtRef.current);
        totalElapsedMsRef.current += delta;
        stageElapsedMsRef.current += delta;
        lastTickAtRef.current = null;
        const next = {
          totalMs: totalElapsedMsRef.current,
          stageMs: stageElapsedMsRef.current,
        };
        if (lastTimingSnapshotRef.current.totalMs !== next.totalMs || lastTimingSnapshotRef.current.stageMs !== next.stageMs) {
          lastTimingSnapshotRef.current = next;
          setTimingSnapshot(next);
        }
      }
      return;
    }
    lastTickAtRef.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const lastTick = lastTickAtRef.current ?? now;
      const delta = Math.max(0, now - lastTick);
      totalElapsedMsRef.current += delta;
      stageElapsedMsRef.current += delta;
      lastTickAtRef.current = now;
      const next = {
        totalMs: totalElapsedMsRef.current,
        stageMs: stageElapsedMsRef.current,
      };
      if (lastTimingSnapshotRef.current.totalMs !== next.totalMs || lastTimingSnapshotRef.current.stageMs !== next.stageMs) {
        lastTimingSnapshotRef.current = next;
        setTimingSnapshot(next);
      }
    }, 1000);
    return () => {
      const now = Date.now();
      const lastTick = lastTickAtRef.current ?? now;
      const delta = Math.max(0, now - lastTick);
      totalElapsedMsRef.current += delta;
      stageElapsedMsRef.current += delta;
      lastTickAtRef.current = null;
      const next = {
        totalMs: totalElapsedMsRef.current,
        stageMs: stageElapsedMsRef.current,
      };
      if (lastTimingSnapshotRef.current.totalMs !== next.totalMs || lastTimingSnapshotRef.current.stageMs !== next.stageMs) {
        lastTimingSnapshotRef.current = next;
        setTimingSnapshot(next);
      }
      window.clearInterval(id);
    };
  }, [buildStatus]);

  useEffect(() => {
    if (buildStatus !== 'running') return;
    if (data?.buildStartedAt) {
      buildStartRequestedRef.current = null;
      return;
    }
    const key = nodeId ?? data?.nodeId ?? null;
    if (!key) return;
    if (buildStartRequestedRef.current === key) return;
    buildStartRequestedRef.current = key;
    onChange({
      buildStartedAt: Date.now(),
      buildFinishedAt: undefined,
    });
  }, [buildStatus, data?.buildStartedAt, data?.nodeId, nodeId, onChange]);

  useEffect(() => {
    if (!monitorKey) return;
    if (buildStatus !== 'running') return;
    const startedAt = data?.buildStartedAt ?? Date.now();
    recordBuildStart(buildMonitorConfig, monitorKey, {
      nodeId: data?.nodeId ? String(data.nodeId) : undefined,
      startedAt,
    });
    const interval = window.setInterval(() => {
      appendBuildSample(buildMonitorConfig, monitorKey, {
        timestamp: Date.now(),
        stage: taskType as 'fetch' | 'transform' | 'vt' | undefined,
        ...getMemorySnapshot(),
      });
    }, BUILD_MONITOR_SAMPLE_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [buildStatus, taskType, data?.buildStartedAt, data?.nodeId, monitorKey]);

  useEffect(() => {
    if (!monitorKey) return;
    if (!['completed', 'failed'].includes(buildStatus)) return;
    if (!data?.buildFinishedAt) {
      onChange({ buildFinishedAt: Date.now() });
    }
    recordBuildFinish(buildMonitorConfig, monitorKey, Date.now());
  }, [buildStatus, data?.buildFinishedAt, monitorKey, onChange]);

  return {
    timingSnapshot,
  };
};
