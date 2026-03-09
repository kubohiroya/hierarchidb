import type { BuildStatusSource } from '~/ui/components/build-progress/resolveBuildStatusSource';
import { getMemorySnapshot } from '@hierarchidb/ui-monitoring';

export type BuildSessionTransitionPhase =
  | 'acquiring-lock'
  | 'waiting-lock'
  | 'saving-draft'
  | 'initializing-worker'
  | 'building-payloads'
  | 'starting-session';

export type BuildStartupStep =
  | 'lock-acquire'
  | 'lock-wait'
  | 'draft-save'
  | 'worker-initialize'
  | 'payload-build'
  | 'session-start-request'
  | 'session-status-persist';

export type BuildStartupStepOutcome = 'success' | 'error' | 'cancelled' | 'aborted';

export type StartupStepMemorySnapshot = {
  usedJSHeapSize: number | null;
  totalJSHeapSize: number | null;
  jsHeapSizeLimit: number | null;
};

export type ShapeProgressStepTracePayload = {
  nodeId: string | null;
  phase: BuildStatusSource;
  progressTaskId: string | null;
  progressTaskStatus: string | null;
  progressTaskStage: string | null;
  progressTaskProgress: number | null;
  percentage: number | null;
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  message: string | null;
};

const toMemoryValue = (value: number | undefined): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

export const captureStartupStepMemorySnapshot = (): StartupStepMemorySnapshot => {
  const snapshot = getMemorySnapshot();
  return {
    usedJSHeapSize: toMemoryValue(snapshot.usedJSHeapSize),
    totalJSHeapSize: toMemoryValue(snapshot.totalJSHeapSize),
    jsHeapSizeLimit: toMemoryValue(snapshot.jsHeapSizeLimit),
  };
};

const subtractMemoryValues = (
  started: number | null | undefined,
  finished: number | null,
): number | null => {
  if (started === null || started === undefined || finished === null) {
    return null;
  }
  return finished - started;
};

export const calculateMemoryDelta = (
  started: StartupStepMemorySnapshot | null,
  finished: StartupStepMemorySnapshot,
): StartupStepMemorySnapshot => ({
  usedJSHeapSize: subtractMemoryValues(started?.usedJSHeapSize, finished.usedJSHeapSize),
  totalJSHeapSize: subtractMemoryValues(started?.totalJSHeapSize, finished.totalJSHeapSize),
  jsHeapSizeLimit: subtractMemoryValues(started?.jsHeapSizeLimit, finished.jsHeapSizeLimit),
});

export const getBuildSessionTransitionStatusLabel = (
  t: (key: string, fallback?: string) => string,
  phase: BuildSessionTransitionPhase | 'idle',
  durationMs: number,
): string => {
  const elapsedSeconds = Math.max(0, Math.floor(durationMs / 1000));
  switch (phase) {
    case 'acquiring-lock':
      return t('build.status.startingLock', 'Starting build (acquiring lock)...');
    case 'waiting-lock':
      return t('build.status.startingQueueElapsed', `Starting build (waiting for lock, ${elapsedSeconds}s)...`);
    case 'saving-draft':
      return t('build.status.startingSave', 'Starting build (saving draft)...');
    case 'initializing-worker':
      return t('build.status.startingWorker', 'Starting build (initializing worker)...');
    case 'building-payloads':
      return t('build.status.startingPayload', 'Starting build (preparing tasks)...');
    case 'starting-session':
      return t('build.status.startingSession', 'Starting build (launching session)...');
    default:
      return t('build.status.starting', 'Starting stage...');
  }
};
