import type { BuildTaskSummary, TaskDisplayPayload, TaskStage } from '@hierarchidb/build-api';
import type { MutableRefObject } from 'react';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';

export type RawTaskSummary = BuildTaskSummary & {
  stage: TaskStage;
  stageId?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  errorMessage?: string;
  index?: number;
  stagePriority?: number;
  updatedAt?: number;
};

export type SyncArgs = {
  sessionNodeId: string | null;
  setTasks: (tasks: ShapeBuildTaskSummary[]) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  markTaskSnapshotProgressSynchronized?: () => void;
  onTaskSnapshot?: (tasks: ShapeBuildTaskSummary[]) => void;
  onTaskTerminalProgressUpdate?: (task: ShapeBuildTaskSummary) => void;
};

export type SyncSchedulingArgs = Pick<
  SyncArgs,
  'sessionNodeId' | 'markTaskSnapshotProgressSynchronized' | 'setTasks'
> & {
  refs: HandlerRefs;
};

export type RunningResidueLogPayload = {
  nodeId: string | null;
  stage?: string | null;
  taskId?: string | null;
  prevStatus?: string | null;
  nextStatus?: string | null;
  source?: string | null;
  timestamp?: number;
  reason?: string | null;
  eventType?: string | null;
  runningCount?: number | null;
  queuedCount?: number | null;
  totalCount?: number | null;
};

export type TaskSyncDebugChannel = 'taskUpdate100' | 'runningResidue';
export type TaskSyncDebugConfig = Partial<Record<TaskSyncDebugChannel | 'all', boolean>>;

export type TileEmitParentInputSummary = {
  parentTile: {
    z: number;
    x: number;
    y: number;
  };
  intersectingFeatureCount: number;
  intersectingGeojsonByteSize: number;
  topCountriesByIntersectingArea?: Array<{
    countryCode: string;
    intersectingAreaSqMeters: number;
  }>;
};

export type ScopeFromTaskId = {
  iso2: string;
  adminLevel: string;
};

export type TaskDisplayValue = TaskDisplayPayload;

export type HandlerRefs = {
  tasksRef: MutableRefObject<ShapeBuildTaskSummary[]>;
  isLoadingRef: MutableRefObject<boolean>;
  errorRef: MutableRefObject<Error | null>;
  committedTasksRef: MutableRefObject<ShapeBuildTaskSummary[]>;
  tasksMapRef: MutableRefObject<Map<string, ShapeBuildTaskSummary>>;
  completedTasksRef: MutableRefObject<Map<string, ShapeBuildTaskSummary>>;
  vtParentInputDebugLogKeysRef: MutableRefObject<Set<string>>;
  pendingTasksRef: MutableRefObject<ShapeBuildTaskSummary[] | null>;
  bufferedSnapshotRef: MutableRefObject<ShapeBuildTaskSummary[] | null>;
  bufferedUpdatesRef: MutableRefObject<Map<string, ShapeBuildTaskSummary>>;
  pendingDirtyRef: MutableRefObject<boolean>;
  flushScheduledRef: MutableRefObject<boolean>;
  flushFrameRef: MutableRefObject<number | null>;
  flushTimeoutRef: MutableRefObject<number | null>;
  isMountedRef: MutableRefObject<boolean>;
};

export type SyncResult = {
  bufferTaskUpdate: (task: ShapeBuildTaskSummary) => void;
  scheduleBufferedFlush: () => void;
  scheduleFlush: (next: ShapeBuildTaskSummary[], dirty?: boolean) => void;
  syncTasksRef: (tasks: ShapeBuildTaskSummary[]) => void;
  syncLoadingRef: (loading: boolean) => void;
  syncErrorRef: (error: Error | null) => void;
  resetPending: () => void;
};
