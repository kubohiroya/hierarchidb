import type {
  BuildProgress,
  BuildSessionRuntimeFilter,
  BuildSessionRuntimeRecord,
  BuildSessionRuntimeStatus,
  CanonicalBuildRuntimeAdapter,
} from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import {
  assertStagedFolderActionRunRecord,
  type CreateStagedFolderActionRunRecordInput,
  createMapImageCaptureIntentRecord,
  createStagedFolderActionRunRecord,
  type MapImageCaptureIntent,
  type MapImageCaptureIntentRecord,
  STAGED_FOLDER_ACTION_RUNTIME_NODE_TYPE,
  type StagedFolderActionRunRecord,
  type StagedFolderActionRunRecordPatch,
  updateStagedFolderActionRunRecord,
} from '@hierarchidb/staged-folder-action';
import Dexie, { type Table } from 'dexie';
import { Subject } from 'rxjs';

type StagedFolderActionProgressUnsubscribe = () => void;

export type StagedFolderActionProgressFilter = {
  runId?: NodeId;
  activeOnly?: boolean;
  statuses?: StagedFolderActionRunRecord['status'][];
};

export class StagedFolderActionProgressStore extends Dexie {
  runs!: Table<StagedFolderActionRunRecord, NodeId>;
  captureIntents!: Table<MapImageCaptureIntentRecord, string>;

  private readonly changes = new Subject<void>();

  constructor(databaseName: string) {
    super(databaseName);
    this.version(1).stores({
      runs: '&runId, sourceNodeId, status, phase, updatedAt',
    });
    this.version(2).stores({
      runs: '&runId, sourceNodeId, status, phase, updatedAt',
      captureIntents: '&intentId, runId, stagingRootNodeId, updatedAt',
    });
  }

  async createRun(
    input: CreateStagedFolderActionRunRecordInput
  ): Promise<StagedFolderActionRunRecord> {
    const record = createStagedFolderActionRunRecord(input);
    await this.runs.add(record);
    this.changes.next();
    return record;
  }

  async getRun(runId: NodeId): Promise<StagedFolderActionRunRecord | null> {
    return (await this.runs.get(runId)) ?? null;
  }

  async listRuns(
    filter: StagedFolderActionProgressFilter = {}
  ): Promise<StagedFolderActionRunRecord[]> {
    const runs = filter.runId
      ? await this.runs.where('runId').equals(filter.runId).toArray()
      : await this.runs.toArray();
    return runs
      .filter((record) => filterRun(record, filter))
      .sort((a, b) => b.updatedAt - a.updatedAt || String(a.runId).localeCompare(String(b.runId)));
  }

  async updateRun(
    runId: NodeId,
    patch: StagedFolderActionRunRecordPatch
  ): Promise<StagedFolderActionRunRecord> {
    const next = await this.transaction('rw', this.runs, async () => {
      const current = await this.runs.get(runId);
      if (!current) {
        throw new Error(`staged-folder-action run ${String(runId)} was not found`);
      }
      const updated = updateStagedFolderActionRunRecord(current, patch);
      await this.runs.put(updated);
      return updated;
    });
    this.changes.next();
    return next;
  }

  async deleteRun(runId: NodeId): Promise<void> {
    await this.transaction('rw', this.runs, this.captureIntents, async () => {
      const record = await this.runs.get(runId);
      if (record && isStagedFolderActionRunActive(record)) {
        throw new Error(`Cannot delete active staged-folder-action run ${String(runId)}.`);
      }
      await this.captureIntents.where('runId').equals(runId).delete();
      await this.runs.delete(runId);
    });
    this.changes.next();
  }

  subscribeRuns(listener: () => void): StagedFolderActionProgressUnsubscribe {
    const subscription = this.changes.subscribe(listener);
    return () => subscription.unsubscribe();
  }

  async putMapImageCaptureIntent(
    intent: MapImageCaptureIntent,
    now: number
  ): Promise<MapImageCaptureIntentRecord> {
    const record = createMapImageCaptureIntentRecord(intent, now);
    await this.captureIntents.put(record);
    this.changes.next();
    return record;
  }

  async getMapImageCaptureIntent(intentId: string): Promise<MapImageCaptureIntentRecord | null> {
    return (await this.captureIntents.get(intentId)) ?? null;
  }

  async deleteMapImageCaptureIntent(intentId: string): Promise<void> {
    await this.captureIntents.delete(intentId);
    this.changes.next();
  }
}

export const isStagedFolderActionRunActive = (record: StagedFolderActionRunRecord): boolean =>
  record.status === 'starting' || record.status === 'running';

export const createStagedFolderActionBuildRuntimeAdapter = (
  store: StagedFolderActionProgressStore
): CanonicalBuildRuntimeAdapter => ({
  nodeType: STAGED_FOLDER_ACTION_RUNTIME_NODE_TYPE,
  getSession: async (nodeId: NodeId): Promise<BuildSessionRuntimeRecord | null> => {
    const record = await store.getRun(nodeId);
    return record ? toBuildSessionRuntimeRecord(record) : null;
  },
  listSessions: async (
    filter?: BuildSessionRuntimeFilter
  ): Promise<BuildSessionRuntimeRecord[]> => {
    const records = await store.listRuns({
      runId: filter?.nodeId,
      activeOnly: filter?.activeOnly,
    });
    return records
      .map(toBuildSessionRuntimeRecord)
      .filter((record) => filterRuntime(record, filter));
  },
  subscribeSessions: (
    filter: BuildSessionRuntimeFilter | undefined,
    callback: (sessions: BuildSessionRuntimeRecord[]) => void
  ): StagedFolderActionProgressUnsubscribe => {
    const dispatch = (): void => {
      void store
        .listRuns({
          runId: filter?.nodeId,
          activeOnly: filter?.activeOnly,
        })
        .then((records) =>
          callback(
            records
              .map(toBuildSessionRuntimeRecord)
              .filter((record) => filterRuntime(record, filter))
          )
        );
    };
    dispatch();
    return store.subscribeRuns(dispatch);
  },
  deleteSession: (nodeId: NodeId): Promise<void> => store.deleteRun(nodeId),
});

export const toBuildSessionRuntimeRecord = (
  record: StagedFolderActionRunRecord
): BuildSessionRuntimeRecord => {
  assertStagedFolderActionRunRecord(record);
  const status = toRuntimeStatus(record);
  return {
    nodeType: STAGED_FOLDER_ACTION_RUNTIME_NODE_TYPE,
    nodeId: record.runId,
    status,
    isActive: isRuntimeStatusActive(status),
    progress: toBuildProgress(record),
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    updatedAt: record.updatedAt,
    error: record.error,
    revision: record.revision,
  };
};

const toBuildProgress = (record: StagedFolderActionRunRecord): BuildProgress => ({
  total: record.progress.total,
  completed: record.progress.completed,
  failed: record.progress.failed,
  skipped: record.progress.skipped,
  percentage: record.progress.percentage,
});

const toRuntimeStatus = (record: StagedFolderActionRunRecord): BuildSessionRuntimeStatus => {
  if (record.status === 'starting') return 'starting';
  if (record.status === 'paused' || record.status === 'auth-required') return 'paused';
  if (record.status === 'completed') return record.phase === 'cleanup' ? 'finalizing' : 'completed';
  if (record.status === 'failed' || record.status === 'cancelled') return 'failed';
  if (record.phase === 'cleanup' || record.phase === 'writing-output') return 'finalizing';
  return 'running';
};

const isRuntimeStatusActive = (status: BuildSessionRuntimeStatus): boolean =>
  status === 'starting' ||
  status === 'running' ||
  status === 'pausing' ||
  status === 'resuming' ||
  status === 'finalizing';

const filterRun = (
  record: StagedFolderActionRunRecord,
  filter: StagedFolderActionProgressFilter
): boolean => {
  if (filter.activeOnly === true && !isStagedFolderActionRunActive(record)) return false;
  if (filter.statuses && !filter.statuses.includes(record.status)) return false;
  return true;
};

const filterRuntime = (
  record: BuildSessionRuntimeRecord,
  filter: BuildSessionRuntimeFilter | undefined
): boolean => {
  if (filter?.statuses && !filter.statuses.includes(record.status)) return false;
  if (filter?.activeOnly === true && !record.isActive) return false;
  return true;
};
