import { SingletonMixin } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBatchSessionSummary,
  ShapeBatchTaskRecord,
  ShapeBatchTaskStage,
  ShapeBatchTaskSummary,
  ShapeExtractedBufferRecord,
  ShapeFeatureMetadataRow,
  ShapeProcessingStatus,
  ShapeQueryAPI,
  ShapeRawBufferRecord,
  ShapeSourceMetadataRow,
  ShapeTileInfo,
  ShapeTileRow,
  ShapeTileSummary,
  ShapeTileSummaryEntry,
} from '@hierarchidb/plugin-service-api';
import { getEphemeralShapeDB, shapeDB } from '@hierarchidb/shape-store';

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

type ShapeBatchTaskRow = {
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
  inputData?: unknown;
  outputData?: unknown;
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
  batchTasks: DexieTable<ShapeBatchTaskRow>;
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

const toTaskSummary = (task: ShapeBatchTaskRow): ShapeBatchTaskSummary => ({
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

  async listBatchTaskRecords(nodeId: NodeId): Promise<ShapeBatchTaskRecord[]> {
    await this.ensureOpen();
    return this.db.batchTasks.where('nodeId').equals(nodeId).toArray() as Promise<ShapeBatchTaskRecord[]>;
  }

  async listBatchTaskRecordsByStage(nodeId: NodeId, stage: ShapeBatchTaskStage): Promise<ShapeBatchTaskRecord[]> {
    const tasks = await this.listBatchTaskRecords(nodeId);
    return tasks.filter((task) => task.taskType === stage);
  }

  async getBatchTaskRecord(taskId: string): Promise<ShapeBatchTaskRecord | null> {
    await this.ensureOpen();
    const task = await this.db.batchTasks.get?.(taskId);
    return (task as ShapeBatchTaskRecord | undefined) ?? null;
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

  async listRawBuffers(nodeId: NodeId): Promise<ShapeRawBufferRecord[]> {
    const db = getEphemeralShapeDB();
    return db.rawBuffers.where('nodeId').equals(nodeId).toArray() as Promise<ShapeRawBufferRecord[]>;
  }

  async getRawBuffer(bufferId: string): Promise<ShapeRawBufferRecord | null> {
    const db = getEphemeralShapeDB();
    const buffer = await db.rawBuffers.get(bufferId);
    return buffer ?? null;
  }

  async listExtractedBuffers(
    nodeId: NodeId,
    stage?: 'extract1' | 'extract2',
  ): Promise<ShapeExtractedBufferRecord[]> {
    const db = getEphemeralShapeDB();
    if (!stage) {
      return db.extractedBuffers.where('nodeId').equals(nodeId).toArray() as Promise<ShapeExtractedBufferRecord[]>;
    }
    return db.extractedBuffers.where('[nodeId+stage]').equals([nodeId, stage]).toArray() as
      Promise<ShapeExtractedBufferRecord[]>;
  }

  async getExtractedBuffer(bufferId: string): Promise<ShapeExtractedBufferRecord | null> {
    const db = getEphemeralShapeDB();
    const buffer = await db.extractedBuffers.get(bufferId);
    return buffer ?? null;
  }

  async listVectorTileRows(nodeId: NodeId): Promise<ShapeTileRow[]> {
    const rows = await shapeDB.vectorTiles.where('nodeId').equals(nodeId).toArray();
    return rows.map((row) => ({
      key: row.tileId,
      nodeId: String(nodeId),
      z: row.z,
      x: row.x,
      y: row.y,
      data: row.data_Uint8Array.buffer.slice(
        row.data_Uint8Array.byteOffset,
        row.data_Uint8Array.byteOffset + row.data_Uint8Array.byteLength,
      ),
      size: row.size,
      contentType: 'application/vnd.mapbox-vector-tile',
      timestamp: row.generatedAt,
    }));
  }

  async listSourceMetadata(nodeId: NodeId): Promise<ShapeSourceMetadataRow[]> {
    return shapeDB.sourceMetadata.where('nodeId').equals(String(nodeId)).toArray() as Promise<ShapeSourceMetadataRow[]>;
  }

  async listFeatureMetadata(nodeId: NodeId): Promise<ShapeFeatureMetadataRow[]> {
    return shapeDB.featureMetadata.where('nodeId').equals(String(nodeId)).toArray() as Promise<ShapeFeatureMetadataRow[]>;
  }
}
