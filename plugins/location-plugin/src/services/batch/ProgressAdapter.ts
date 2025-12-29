import type { NodeId } from '@hierarchidb/common-types';
import type { BatchProgressEvent, BatchProgressPayload } from '@hierarchidb/common-api';
import { mapStageToBatchStage } from './runtimeBridge.js';

export function toBatchProgressEvent(ev: {
  nodeId: NodeId;
  stage: string;
  total?: number;
  completed?: number;
  failed?: number;
  percentage?: number;
  currentTask?: string;
}): BatchProgressEvent {
  const mappedStage = mapStageToBatchStage(ev.stage);
  const total = ev.total ?? 100;
  const pct = typeof ev.percentage === 'number'
    ? ev.percentage
    : total > 0
      ? Math.round(((ev.completed ?? 0) / total) * 100)
      : 0;
  const payload: BatchProgressPayload = {
    total,
    completed: ev.completed ?? Math.round((pct / 100) * total),
    failed: ev.failed ?? 0,
    currentTask: ev.currentTask,
  };
  return {
    nodeId: ev.nodeId,
    stage: mappedStage,
    phase: pct >= 100 ? 'completed' : 'running',
    timestamp: Date.now(),
    payload,
  };
}
