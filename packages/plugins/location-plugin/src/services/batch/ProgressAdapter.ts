import type { NodeId } from '@hierarchidb/common-types';
import type { BatchProgressEvent, BatchProgressPayload } from '@hierarchidb/runtime-shared-batch-processor';

// Location plugin internal stage names → shared vocabulary
// Shape uses: download, simplify1, simplify2, vectortile
// Location currently uses: download, filter, cluster, index
const stageMap: Record<string, BatchProgressEvent['stage']> = {
  download: 'download',
  filter: 'simplify1',
  cluster: 'simplify2',
  index: 'vectortile',
};

export function toBatchProgressEvent(ev: {
  sessionId: string;
  nodeId?: NodeId;
  stage: string;
  total?: number;
  completed?: number;
  failed?: number;
  percentage?: number;
  currentTask?: string;
}): BatchProgressEvent {
  const mappedStage = stageMap[ev.stage] ?? (ev.stage as BatchProgressEvent['stage']);
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
    sessionId: ev.sessionId,
    nodeId: ev.nodeId ?? ('' as NodeId),
    stage: mappedStage,
    phase: pct >= 100 ? 'completed' : 'running',
    timestamp: Date.now(),
    payload,
  };
}
