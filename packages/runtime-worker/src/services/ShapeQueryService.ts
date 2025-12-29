import { SingletonMixin } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBatchSessionSummary,
  ShapeBatchTaskSummary,
  ShapeProcessingStatus,
  ShapeQueryAPI,
  ShapeTileInfo,
  ShapeTileSummary,
  ShapeTileSummaryEntry,
} from '@hierarchidb/plugin-service-api';

type ShapeBatchSessionRecord = {
  nodeId: NodeId;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'idle';
  startedAt?: number;
  updatedAt?: number;
  completedAt?: number;
  progress?: {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    percentage: number;
    currentStage?: string;
    currentTask?: string;
  };
};

type ShapeBatchTaskRecord = {
  taskId: string;
  nodeId: NodeId;
  taskType: string;
  status: string;
  index: number;
  progress: number;
  message?: string;
  startedAt?: number;
  completedAt?: number;
  errorMessage?: string;
};

type ShapeVectorTileRecord = {
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  size: number;
  features: number;
  layers: Array<{ name: string; featureCount?: number; geometryType?: string }>;
  generatedAt: number;
  lastAccessed?: number;
  data_Uint8Array: Uint8Array | ArrayBuffer;
};

type DexieCollection<T> = {
  toArray(): Promise<T[]>;
  count(): Promise<number>;
};

type DexieWhere<T> = {
  equals(value: unknown): DexieCollection<T> & { delete?: () => Promise<number> };
};

type DexieTable<T> = {
  where(key: string): DexieWhere<T>;
  get?(id: string): Promise<T | undefined>;
};

type ShapeDatabaseLike = {
  open?: () => Promise<unknown>;
  batchSessions: DexieTable<ShapeBatchSessionRecord>;
  batchTasks: DexieTable<ShapeBatchTaskRecord>;
  features: DexieTable<{ nodeId: NodeId }>;
  vectorTiles: DexieTable<ShapeVectorTileRecord>;
  getVectorTile?: (nodeId: NodeId, z: number, x: number, y: number) => Promise<ShapeVectorTileRecord | undefined>;
};

const mapStatus = (status: ShapeBatchSessionRecord['status']): ShapeProcessingStatus['status'] => {
  if (status === 'running') return 'processing';
  if (status === 'idle') return 'idle';
  return status;
};

const toSessionSummary = (session: ShapeBatchSessionRecord): ShapeBatchSessionSummary => ({
  nodeId: session.nodeId,
  status: mapStatus(session.status),
  startedAt: session.startedAt,
  updatedAt: session.updatedAt,
  completedAt: session.completedAt,
  progress: session.progress,
});

const toTaskSummary = (task: ShapeBatchTaskRecord): ShapeBatchTaskSummary => ({
  taskId: task.taskId,
  nodeId: task.nodeId,
  taskType: task.taskType,
  status: task.status,
  index: task.index,
  progress: task.progress,
  message: task.message,
  startedAt: task.startedAt,
  completedAt: task.completedAt,
  errorMessage: task.errorMessage,
});

export class ShapeQueryService implements ShapeQueryAPI {
  static async getSingleton(db: ShapeDatabaseLike): Promise<ShapeQueryService> {
    return SingletonMixin.getSingleton('ShapeQueryService', async () => new ShapeQueryService(db));
  }

  constructor(private db: ShapeDatabaseLike) {}

  private async ensureOpen(): Promise<void> {
    await this.db.open?.();
  }

  async listBatchSessions(nodeId: NodeId): Promise<ShapeBatchSessionSummary[]> {
    await this.ensureOpen();
    const sessions = await this.db.batchSessions.where('nodeId').equals(nodeId).toArray();
    return sessions.map(toSessionSummary);
  }

  async getBatchSession(nodeId: NodeId): Promise<ShapeBatchSessionSummary | null> {
    await this.ensureOpen();
    const session = await this.db.batchSessions.get?.(String(nodeId));
    return session ? toSessionSummary(session) : null;
  }

  async listBatchTasks(nodeId: NodeId): Promise<ShapeBatchTaskSummary[]> {
    await this.ensureOpen();
    const tasks = await this.db.batchTasks.where('nodeId').equals(nodeId).toArray();
    return tasks.map(toTaskSummary);
  }

  async getProcessingStatus(nodeId: NodeId): Promise<ShapeProcessingStatus | null> {
    await this.ensureOpen();
    const sessions = await this.db.batchSessions.where('nodeId').equals(nodeId).toArray();
    const latest = sessions.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
    if (!latest) {
      return {
        status: 'idle',
        hasErrors: false,
        errorMessages: [],
      };
    }
    const totalFeatures = await this.getProcessedFeatureCount(nodeId);
    const totalVectorTiles = await this.db.vectorTiles.where('nodeId').equals(nodeId).count();
    return {
      status: mapStatus(latest.status),
      lastProcessed: latest.completedAt ?? latest.updatedAt,
      totalFeatures,
      totalVectorTiles,
      hasErrors: latest.status === 'failed',
      errorMessages: latest.status === 'failed' ? ['Batch processing failed'] : [],
      stage: latest.progress?.currentStage,
      progress: latest.progress?.percentage,
      lastUpdated: latest.updatedAt,
    };
  }

  async getProcessedFeatureCount(nodeId: NodeId): Promise<number> {
    await this.ensureOpen();
    return this.db.features.where('nodeId').equals(nodeId).count();
  }

  async getVectorTileInfo(nodeId: NodeId, z: number, x: number, y: number): Promise<ShapeTileInfo | null> {
    await this.ensureOpen();
    const tile = await this.db.getVectorTile?.(nodeId, z, x, y)
      ?? (await this.db.vectorTiles.where('[nodeId+z+x+y]').equals([nodeId, z, x, y]).toArray())[0];
    if (!tile) return null;
    return {
      exists: true,
      size: tile.size,
      features: tile.features,
      layers: tile.layers ?? [],
      generatedAt: tile.generatedAt,
      lastAccessed: tile.lastAccessed,
    };
  }

  async getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<Uint8Array | null> {
    await this.ensureOpen();
    const tile = await this.db.getVectorTile?.(nodeId, z, x, y)
      ?? (await this.db.vectorTiles.where('[nodeId+z+x+y]').equals([nodeId, z, x, y]).toArray())[0];
    if (!tile) return null;
    const data = tile.data_Uint8Array;
    if (data instanceof Uint8Array) return data;
    return new Uint8Array(data);
  }

  async listVectorTiles(nodeId: NodeId): Promise<ShapeTileSummaryEntry[]> {
    await this.ensureOpen();
    const tiles = await this.db.vectorTiles.where('nodeId').equals(nodeId).toArray();
    return tiles.map((tile) => ({
      z: tile.z,
      x: tile.x,
      y: tile.y,
      size: tile.size,
      timestamp: tile.generatedAt,
    }));
  }

  async getVectorTileSummary(nodeId: NodeId): Promise<ShapeTileSummary> {
    await this.ensureOpen();
    const tiles = await this.db.vectorTiles.where('nodeId').equals(nodeId).toArray();
    if (tiles.length === 0) {
      return { tiles: 0, totalBytes: 0 };
    }
    const totalBytes = tiles.reduce((sum, tile) => sum + tile.size, 0);
    const zoomLevels = tiles.map((tile) => tile.z);
    return {
      tiles: tiles.length,
      totalBytes,
      zoomMin: Math.min(...zoomLevels),
      zoomMax: Math.max(...zoomLevels),
    };
  }
}
