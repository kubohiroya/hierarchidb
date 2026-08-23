import type {
  BuildSessionStatus,
  BuildSessionStatusValue,
  CanonicalBuildInputSource,
} from '@hierarchidb/build-api';
import type { NodeId, TreeId } from '@hierarchidb/core-types';

export type BuildJobQueueMode = 'web-ui' | 'export';

export type BuildJobQueueStatus =
  | 'pending'
  | 'running'
  | 'pausing'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type BuildJobQueueEntryStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'cancelled';

export type BuildQueueEntryDraft = {
  targetNodeId: NodeId;
  nodeType: string;
  inputSource: CanonicalBuildInputSource;
  stepId: 'build' | 'data-source';
  stepNumber: number;
  shouldAutoStart: boolean;
  displayUrl?: string;
};

export type BuildJobQueueEntry = BuildQueueEntryDraft & {
  entryId: string;
  order: number;
  status: BuildJobQueueEntryStatus;
  startedAt?: number;
  completedAt?: number;
  error?: string;
};

export type BuildJobQueue = {
  queueId: string;
  treeId: TreeId;
  ownerNodeId: NodeId;
  createdAt: number;
  createdBy: string;
  mode: BuildJobQueueMode;
  status: BuildJobQueueStatus;
  entries: BuildJobQueueEntry[];
};

export type BuildJobQueueStartTransport = {
  initialize?: () => Promise<void>;
  startBuildSession: (
    nodeType: string,
    nodeId: NodeId,
    inputSource: CanonicalBuildInputSource
  ) => Promise<BuildSessionStatus>;
  getBuildSessionStatus: (nodeType: string, nodeId: NodeId) => Promise<BuildSessionStatus>;
};

type BuildJobQueueListener = (queues: BuildJobQueue[]) => void;

export const BUILD_JOB_QUEUE_OPEN_EVENT = 'hierarchidb:open-build-job-queue';

export type BuildJobQueueOpenEventDetail = {
  queueId: string;
  treeId: TreeId;
};

const BUILD_JOB_TERMINAL_STATUSES = new Set<BuildSessionStatusValue>([
  'completed',
  'failed',
  'paused',
]);

const POLL_INTERVAL_MS = 1000;
const STORAGE_PREFIX = 'hdb.buildJobQueue.';

let store: Record<string, BuildJobQueue> = {};
const listeners = new Set<BuildJobQueueListener>();
let storageLoaded = false;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const createQueueId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `build-job-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const hasLocalStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const storageKey = (queueId: string): string => `${STORAGE_PREFIX}${queueId}`;

const assertNonEmptyString = (value: unknown, fieldName: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`[buildJobQueue] ${fieldName} must be a non-empty string`);
  }
  return value;
};

const assertFiniteNonNegative = (value: unknown, fieldName: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`[buildJobQueue] ${fieldName} must be a finite non-negative number`);
  }
  return value;
};

const assertBoolean = (value: unknown, fieldName: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`[buildJobQueue] ${fieldName} must be a boolean`);
  }
  return value;
};

const assertInputSource = (value: unknown): CanonicalBuildInputSource => {
  if (value !== 'committed' && value !== 'working-copy') {
    throw new Error('[buildJobQueue] inputSource must be committed or working-copy');
  }
  return value;
};

const assertStepId = (value: unknown): 'build' | 'data-source' => {
  if (value !== 'build' && value !== 'data-source') {
    throw new Error('[buildJobQueue] stepId must be build or data-source');
  }
  return value;
};

const assertQueueStatus = (value: unknown): BuildJobQueueStatus => {
  if (
    value !== 'pending' &&
    value !== 'running' &&
    value !== 'pausing' &&
    value !== 'paused' &&
    value !== 'completed' &&
    value !== 'failed' &&
    value !== 'cancelled'
  ) {
    throw new Error('[buildJobQueue] queue status is invalid');
  }
  return value;
};

const assertEntryStatus = (value: unknown): BuildJobQueueEntryStatus => {
  if (
    value !== 'pending' &&
    value !== 'running' &&
    value !== 'completed' &&
    value !== 'failed' &&
    value !== 'paused' &&
    value !== 'cancelled'
  ) {
    throw new Error('[buildJobQueue] entry status is invalid');
  }
  return value;
};

const assertQueueMode = (value: unknown): BuildJobQueueMode => {
  if (value !== 'web-ui' && value !== 'export') {
    throw new Error('[buildJobQueue] queue mode is invalid');
  }
  return value;
};

const assertOptionalFiniteNonNegative = (value: unknown, fieldName: string): number | undefined => {
  if (value === undefined) return undefined;
  return assertFiniteNonNegative(value, fieldName);
};

const assertOptionalNonEmptyString = (value: unknown, fieldName: string): string | undefined => {
  if (value === undefined) return undefined;
  return assertNonEmptyString(value, fieldName);
};

const cloneQueue = (queue: BuildJobQueue): BuildJobQueue => ({
  ...queue,
  entries: queue.entries.map((entry) => ({ ...entry })),
});

const parsePersistedQueue = (raw: unknown): BuildJobQueue => {
  if (!isRecord(raw)) {
    throw new Error('[buildJobQueue] persisted queue must be an object');
  }
  const queueId = assertNonEmptyString(raw.queueId, 'queueId');
  const entriesRaw = raw.entries;
  if (!Array.isArray(entriesRaw) || entriesRaw.length === 0) {
    throw new Error('[buildJobQueue] persisted entries must be a non-empty array');
  }
  const entries = entriesRaw.map((entryRaw) => {
    if (!isRecord(entryRaw)) {
      throw new Error('[buildJobQueue] persisted entry must be an object');
    }
    const order = assertFiniteNonNegative(entryRaw.order, 'order');
    if (!Number.isInteger(order)) {
      throw new Error('[buildJobQueue] order must be an integer');
    }
    const stepNumber = assertFiniteNonNegative(entryRaw.stepNumber, 'stepNumber');
    if (!Number.isInteger(stepNumber) || stepNumber < 1) {
      throw new Error('[buildJobQueue] stepNumber must be a positive integer');
    }
    return {
      targetNodeId: assertNonEmptyString(entryRaw.targetNodeId, 'targetNodeId') as NodeId,
      nodeType: assertNonEmptyString(entryRaw.nodeType, 'nodeType'),
      inputSource: assertInputSource(entryRaw.inputSource),
      stepId: assertStepId(entryRaw.stepId),
      stepNumber,
      shouldAutoStart: assertBoolean(entryRaw.shouldAutoStart, 'shouldAutoStart'),
      displayUrl: assertOptionalNonEmptyString(entryRaw.displayUrl, 'displayUrl'),
      entryId: assertNonEmptyString(entryRaw.entryId, 'entryId'),
      order,
      status: assertEntryStatus(entryRaw.status),
      startedAt: assertOptionalFiniteNonNegative(entryRaw.startedAt, 'startedAt'),
      completedAt: assertOptionalFiniteNonNegative(entryRaw.completedAt, 'completedAt'),
      error: assertOptionalNonEmptyString(entryRaw.error, 'error'),
    } satisfies BuildJobQueueEntry;
  });
  return {
    queueId,
    treeId: assertNonEmptyString(raw.treeId, 'treeId') as TreeId,
    ownerNodeId: assertNonEmptyString(raw.ownerNodeId, 'ownerNodeId') as NodeId,
    createdAt: assertFiniteNonNegative(raw.createdAt, 'createdAt'),
    createdBy: assertNonEmptyString(raw.createdBy, 'createdBy'),
    mode: assertQueueMode(raw.mode),
    status: assertQueueStatus(raw.status),
    entries,
  } satisfies BuildJobQueue;
};

const persistQueue = (queue: BuildJobQueue): void => {
  if (!hasLocalStorage()) return;
  window.localStorage.setItem(storageKey(queue.queueId), JSON.stringify(queue));
};

const removePersistedQueue = (queueId: string): void => {
  if (!hasLocalStorage()) return;
  window.localStorage.removeItem(storageKey(queueId));
};

const loadPersistedQueues = (): void => {
  if (storageLoaded || !hasLocalStorage()) return;
  storageLoaded = true;
  const nextStore = { ...store };
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(STORAGE_PREFIX)) continue;
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    const parsed = parsePersistedQueue(JSON.parse(raw));
    nextStore[parsed.queueId] = parsed;
  }
  store = nextStore;
};

const publish = (): void => {
  loadPersistedQueues();
  const queues = Object.values(store).map(cloneQueue);
  for (const listener of Array.from(listeners)) {
    listener(queues);
  }
};

const updateQueue = (queueId: string, updater: (queue: BuildJobQueue) => BuildJobQueue): void => {
  const current = store[queueId];
  if (!current) {
    throw new Error(`[buildJobQueue] queue not found: ${queueId}`);
  }
  const updated = updater(cloneQueue(current));
  store = {
    ...store,
    [queueId]: updated,
  };
  persistQueue(updated);
  publish();
};

const updateEntry = (
  queue: BuildJobQueue,
  entryId: string,
  updater: (entry: BuildJobQueueEntry) => BuildJobQueueEntry
): BuildJobQueue => ({
  ...queue,
  entries: queue.entries.map((entry) =>
    entry.entryId === entryId ? updater({ ...entry }) : entry
  ),
});

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const waitForTerminalStatus = async (
  transport: BuildJobQueueStartTransport,
  entry: BuildJobQueueEntry
): Promise<BuildSessionStatus> => {
  let status = await transport.getBuildSessionStatus(entry.nodeType, entry.targetNodeId);
  while (!BUILD_JOB_TERMINAL_STATUSES.has(status.status)) {
    await sleep(POLL_INTERVAL_MS);
    status = await transport.getBuildSessionStatus(entry.nodeType, entry.targetNodeId);
  }
  return status;
};

export const createBuildJobQueue = (params: {
  treeId: TreeId;
  ownerNodeId: NodeId;
  entries: BuildQueueEntryDraft[];
  mode?: BuildJobQueueMode;
  createdBy?: string;
  queueId?: string;
  createdAt?: number;
}): BuildJobQueue => {
  const treeId = assertNonEmptyString(params.treeId, 'treeId') as TreeId;
  const ownerNodeId = assertNonEmptyString(params.ownerNodeId, 'ownerNodeId') as NodeId;
  if (!Array.isArray(params.entries) || params.entries.length === 0) {
    throw new Error('[buildJobQueue] entries must be a non-empty array');
  }

  const createdAt = params.createdAt ?? Date.now();
  assertFiniteNonNegative(createdAt, 'createdAt');
  const queueId = params.queueId
    ? assertNonEmptyString(params.queueId, 'queueId')
    : createQueueId();
  const createdBy = params.createdBy ?? 'tree-console';
  assertNonEmptyString(createdBy, 'createdBy');

  const entries = params.entries.map((draft, index) => {
    if (!isRecord(draft)) {
      throw new Error('[buildJobQueue] entry draft must be an object');
    }
    const targetNodeId = assertNonEmptyString(draft.targetNodeId, 'targetNodeId') as NodeId;
    const nodeType = assertNonEmptyString(draft.nodeType, 'nodeType');
    const stepNumber = assertFiniteNonNegative(draft.stepNumber, 'stepNumber');
    if (!Number.isInteger(stepNumber) || stepNumber < 1) {
      throw new Error('[buildJobQueue] stepNumber must be a positive integer');
    }
    const displayUrl =
      draft.displayUrl === undefined
        ? undefined
        : assertNonEmptyString(draft.displayUrl, 'displayUrl');
    return {
      targetNodeId,
      nodeType,
      inputSource: assertInputSource(draft.inputSource),
      stepId: assertStepId(draft.stepId),
      stepNumber,
      shouldAutoStart: draft.shouldAutoStart === true,
      displayUrl,
      entryId: `${queueId}:${index + 1}`,
      order: index,
      status: 'pending',
    } satisfies BuildJobQueueEntry;
  });

  const queue = {
    queueId,
    treeId,
    ownerNodeId,
    createdAt,
    createdBy,
    mode: params.mode ?? 'web-ui',
    status: 'pending',
    entries,
  } satisfies BuildJobQueue;

  store = { ...store, [queueId]: queue };
  persistQueue(queue);
  publish();
  return cloneQueue(queue);
};

export const getBuildJobQueue = (queueId: string): BuildJobQueue | null => {
  assertNonEmptyString(queueId, 'queueId');
  loadPersistedQueues();
  const queue = store[queueId];
  return queue ? cloneQueue(queue) : null;
};

export const listBuildJobQueues = (): BuildJobQueue[] => {
  loadPersistedQueues();
  return Object.values(store).map(cloneQueue);
};

export const subscribeBuildJobQueues = (listener: BuildJobQueueListener): (() => void) => {
  listeners.add(listener);
  listener(listBuildJobQueues());
  return () => {
    listeners.delete(listener);
  };
};

export const openBuildJobQueueSurface = (queueId: string): void => {
  assertNonEmptyString(queueId, 'queueId');
  const queue = getBuildJobQueue(queueId);
  if (!queue) {
    throw new Error(`[buildJobQueue] queue not found: ${queueId}`);
  }
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<BuildJobQueueOpenEventDetail>(BUILD_JOB_QUEUE_OPEN_EVENT, {
      detail: { queueId, treeId: queue.treeId },
    })
  );
};

export const deleteBuildJobQueue = (queueId: string): void => {
  assertNonEmptyString(queueId, 'queueId');
  deleteBuildJobQueues([queueId]);
};

export const deleteBuildJobQueues = (queueIds: string[]): void => {
  if (!Array.isArray(queueIds) || queueIds.length === 0) {
    throw new Error('[buildJobQueue] queueIds must be a non-empty array');
  }
  loadPersistedQueues();
  const deletedQueueIds = queueIds.map((queueId) => assertNonEmptyString(queueId, 'queueId'));
  const deletedQueueIdSet = new Set(deletedQueueIds);
  for (const queueId of deletedQueueIdSet) {
    if (!store[queueId]) {
      throw new Error(`[buildJobQueue] queue not found: ${queueId}`);
    }
  }
  store = Object.fromEntries(
    Object.entries(store).filter(([queueId]) => !deletedQueueIdSet.has(queueId))
  );
  for (const queueId of deletedQueueIdSet) {
    removePersistedQueue(queueId);
  }
  publish();
};

export const deleteBuildJobQueuesForTree = (treeId: TreeId): void => {
  const normalizedTreeId = assertNonEmptyString(treeId, 'treeId') as TreeId;
  loadPersistedQueues();
  const remaining: Record<string, BuildJobQueue> = {};
  const deletedQueueIds: string[] = [];
  for (const queue of Object.values(store)) {
    if (queue.treeId === normalizedTreeId) {
      deletedQueueIds.push(queue.queueId);
      continue;
    }
    remaining[queue.queueId] = queue;
  }
  if (deletedQueueIds.length === 0) return;
  store = remaining;
  for (const queueId of deletedQueueIds) {
    removePersistedQueue(queueId);
  }
  publish();
};

export const startBuildJobQueue = async (
  queueId: string,
  transport: BuildJobQueueStartTransport
): Promise<BuildJobQueue> => {
  assertNonEmptyString(queueId, 'queueId');
  if (transport.initialize) {
    await transport.initialize();
  }

  updateQueue(queueId, (queue) => ({ ...queue, status: 'running' }));

  for (;;) {
    const current = getBuildJobQueue(queueId);
    if (!current) {
      throw new Error(`[buildJobQueue] queue not found: ${queueId}`);
    }
    const nextEntry = current.entries.find((entry) => entry.status === 'pending');
    if (!nextEntry) {
      updateQueue(queueId, (queue) => ({ ...queue, status: 'completed' }));
      const completed = getBuildJobQueue(queueId);
      if (!completed) {
        throw new Error(`[buildJobQueue] queue not found after completion: ${queueId}`);
      }
      return completed;
    }

    const startedAt = Date.now();
    updateQueue(queueId, (queue) =>
      updateEntry(queue, nextEntry.entryId, (entry) => ({
        ...entry,
        status: 'running',
        startedAt,
      }))
    );

    try {
      if (!nextEntry.shouldAutoStart) {
        updateQueue(queueId, (queue) => ({
          ...updateEntry(queue, nextEntry.entryId, (entry) => ({
            ...entry,
            status: 'paused',
            error: 'build entry cannot auto-start',
          })),
          status: 'paused',
        }));
        const stopped = getBuildJobQueue(queueId);
        if (!stopped) {
          throw new Error(`[buildJobQueue] queue not found after auto-start stop: ${queueId}`);
        }
        return stopped;
      }
      const startStatus = await transport.startBuildSession(
        nextEntry.nodeType,
        nextEntry.targetNodeId,
        nextEntry.inputSource
      );
      const terminalStatus = BUILD_JOB_TERMINAL_STATUSES.has(startStatus.status)
        ? startStatus
        : await waitForTerminalStatus(transport, nextEntry);
      if (terminalStatus.nodeId !== nextEntry.targetNodeId) {
        throw new Error(
          `[buildJobQueue] build status nodeId mismatch: expected=${String(nextEntry.targetNodeId)}, actual=${String(terminalStatus.nodeId)}`
        );
      }
      const completedAt = Date.now();
      if (terminalStatus.status === 'completed') {
        updateQueue(queueId, (queue) =>
          updateEntry(queue, nextEntry.entryId, (entry) => ({
            ...entry,
            status: 'completed',
            completedAt,
          }))
        );
        continue;
      }
      const entryStatus = terminalStatus.status === 'paused' ? 'paused' : 'failed';
      const error = terminalStatus.error ?? terminalStatus.stopReason ?? terminalStatus.status;
      updateQueue(queueId, (queue) => ({
        ...updateEntry(queue, nextEntry.entryId, (entry) => ({
          ...entry,
          status: entryStatus,
          completedAt,
          error,
        })),
        status: entryStatus === 'paused' ? 'paused' : 'failed',
      }));
      const stopped = getBuildJobQueue(queueId);
      if (!stopped) {
        throw new Error(`[buildJobQueue] queue not found after stop: ${queueId}`);
      }
      return stopped;
    } catch (error) {
      const completedAt = Date.now();
      const message = error instanceof Error ? error.message : String(error);
      updateQueue(queueId, (queue) => ({
        ...updateEntry(queue, nextEntry.entryId, (entry) => ({
          ...entry,
          status: 'failed',
          completedAt,
          error: message,
        })),
        status: 'failed',
      }));
      throw error;
    }
  }
};

export const resetBuildJobQueuesForTests = (): void => {
  store = {};
  storageLoaded = false;
  if (hasLocalStorage()) {
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(STORAGE_PREFIX)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      window.localStorage.removeItem(key);
    }
  }
  publish();
};
