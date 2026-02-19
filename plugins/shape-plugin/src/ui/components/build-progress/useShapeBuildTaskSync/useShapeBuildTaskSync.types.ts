import type { BuildTaskSummary, TaskDisplayPayload } from '@hierarchidb/batch-api';
import type { MutableRefObject } from 'react';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';

export type RawTaskSummary = BuildTaskSummary & {
  taskType?: string;
  type?: string;
  stage?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  errorMessage?: string;
  index?: number;
  stagePriority?: number;
  sequence?: number;
  updatedAt?: number;
};

export type SyncArgs = {
  sessionNodeId: string | null;
  setTasks: (tasks: ShapeBuildTaskSummary[]) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  markTaskStreamSynchronized?: () => void;
};

export type SyncSchedulingArgs = Pick<
  SyncArgs,
  'sessionNodeId' | 'markTaskStreamSynchronized' | 'setTasks'
> & {
  refs: HandlerRefs;
};

export type RunningResidueLogPayload = {
  nodeId: string | null;
  stage?: string | null;
  taskId?: string | null;
  sequence?: number | null;
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

export type VtParentInputSummary = {
  parentTile: {
    z: number;
    x: number;
    y: number;
  };
  intersectingFeatureCount: number;
  intersectingGeojsonByteSize: number;
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
  bufferedSequenceRef: MutableRefObject<Map<string, number>>;
  committedSequenceRef: MutableRefObject<Map<string, number>>;
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
