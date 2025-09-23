import type { StandardProgressEvent } from '@hierarchidb/runtime-shared-batch-processor';

// Location plugin internal stage names → shared vocabulary
// Shape uses: download, simplify1, simplify2, vectortile
// Location currently uses: download, filter, cluster, index
const stageMap: Record<string, StandardProgressEvent['stage']> = {
  download: 'download',
  filter: 'simplify1',
  cluster: 'simplify2',
  index: 'vectortile',
};

export function toStandardProgressEvent(ev: {
  sessionId: string;
  stage: string;
  total?: number;
  completed?: number;
  failed?: number;
  percentage?: number;
  currentTask?: string;
}): StandardProgressEvent {
  const mappedStage = stageMap[ev.stage] ?? (ev.stage as StandardProgressEvent['stage']);
  const total = ev.total ?? 100;
  const pct = typeof ev.percentage === 'number'
    ? ev.percentage
    : total > 0
      ? Math.round(((ev.completed ?? 0) / total) * 100)
      : 0;
  return {
    sessionId: ev.sessionId,
    stage: mappedStage,
    total,
    completed: ev.completed ?? Math.round((pct / 100) * total),
    failed: ev.failed ?? 0,
    percentage: pct,
    currentTask: ev.currentTask,
  };
}

