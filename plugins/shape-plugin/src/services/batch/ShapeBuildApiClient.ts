import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBatchSessionRecord,
  ShapeBatchSessionSummary,
  ShapeBuildTaskRecord,
  ShapeBuildTaskStatus,
  ShapeEphemeralAPI,
  ShapeEphemeralSessionRecord,
  ShapeTransformSourceBufferRecord,
  ShapeFeatureRecord,
  ShapeFeatureMetadataRow,
  ShapeMutationAPI,
  ShapeProcessingStatus,
  ShapeQueryAPI,
  ShapeFetchBufferRecord,
  ShapeSourceMetadataRow,
  ShapeGeojsonVtIndexRecord,
  ShapeTileIdToBufferRelation,
  ShapeTileInfo,
  ShapeTileRow,
  ShapeTileSummary,
  ShapeTileSummaryEntry,
  ShapeVectorTileRecord,
  ShapeBuildTaskSummary,
  ShapeBuildStage,
} from '@hierarchidb/plugin-service-api';
import {
  bufferDeserializer,
  bufferSerializer,
  countRawDataDataSourceBuffersForNode,
  createShapeChunkStore,
  listRawDataDataSourceMetadataForNode,
  readRawDataDataSourceBuffer,
  storeRawDataDataSourceBufferForNode,
} from '../utils/chunkStore.js';
import { geojson as geojsonApi } from 'flatgeobuf';
import { bbox as turfBbox } from '@turf/turf';
import type { Feature, FeatureCollection } from 'geojson';
import {
  toBatchSessionRecord,
  toBatchSessionUpdates,
  toProgressSummary,
  toShapeBatchSessionRecord,
  toVectorTileRecord,
} from './shapeSessionMappers.js';
import type { TransformFeatureBuffer } from '@hierarchidb/gis-sdk';


import {shapeDB, ephemeralShapeDB} from '@hierarchidb/shape-store';

const mapStatus = (status: ShapeBatchSessionSummary['status'] | 'running' | 'idle'): ShapeProcessingStatus['status'] => {
  if (status === 'running') return 'processing';
  if (status === 'idle') return 'idle';
  return status;
};

const isFeatureCollection = (value: unknown): value is FeatureCollection => (
  !!value
  && typeof value === 'object'
  && (value as FeatureCollection).type === 'FeatureCollection'
  && Array.isArray((value as FeatureCollection).features)
);

const decodeDownloadGeoJson = async (buffer: ArrayBuffer): Promise<unknown> => {
  const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
  if (decoded && typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
    const features: Feature[] = [];
    for await (const feature of decoded as AsyncIterable<Feature>) {
      if (feature) features.push(feature);
    }
    return { type: 'FeatureCollection', features };
  }
  return decoded;
};

const summarizeDownloadBuffer = async (buffer: ArrayBuffer, contentType?: string): Promise<{
  featureCount: number;
  bbox: [number, number, number, number];
}> => {
  const decoded = await decodeRawDataBuffer(buffer, contentType);
  if (!isFeatureCollection(decoded)) {
    return { featureCount: 0, bbox: [0, 0, 0, 0] };
  }
  const bounds = turfBbox(decoded);
  return {
    featureCount: decoded.features.filter(Boolean).length,
    bbox: [bounds[0], bounds[1], bounds[2], bounds[3]],
  };
};

const decodeRawDataBuffer = async (buffer: ArrayBuffer, contentType?: string): Promise<unknown> => {
  try {
    const normalized = (contentType ?? '').toLowerCase();
    if (normalized.includes('zip') || isZipBuffer(buffer)) {
      const jsonBuffer = await unzipJsonBuffer(buffer);
      return JSON.parse(new TextDecoder('utf-8').decode(jsonBuffer));
    }
    if (normalized.includes('json')) {
      return JSON.parse(new TextDecoder('utf-8').decode(buffer));
    }
    return await decodeDownloadGeoJson(buffer);
  } catch {
    return null;
  }
};

const isZipBuffer = (buffer: ArrayBuffer): boolean => {
  const bytes = new Uint8Array(buffer);
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
};

const unzipJsonBuffer = async (buffer: ArrayBuffer): Promise<ArrayBuffer> => {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const zipData = await zip.loadAsync(buffer);
  for (const [fileName, fileData] of Object.entries(zipData.files)) {
    if (fileName.endsWith('.json') && !fileData.dir) {
      const text = await fileData.async('string');
      return new TextEncoder().encode(text).buffer;
    }
  }
  throw new Error('No JSON file found in archive');
};

const toTaskSummary = (task: ShapeBuildTaskRecord): ShapeBuildTaskSummary => ({
  taskId: task.taskId,
  nodeId: task.nodeId,
  taskType: task.taskType,
  status: task.status,
  index: task.index,
  progress: task.progress,
  message: task.message,
  errorMessage: task.errorMessage,
});

export class ShapeQueryAPIImpl implements ShapeQueryAPI {
  async listBatchSessions(nodeId: NodeId): Promise<ShapeBatchSessionSummary[]> {
    const sessions = await shapeDB.batchSessions.where('nodeId').equals(nodeId).toArray();
    return sessions.map((session) => ({
      nodeId: session.nodeId,
      status: mapStatus(session.status),
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt,
      progress: toProgressSummary(session.progress),
    }));
  }

  async getBatchSession(nodeId: NodeId): Promise<ShapeBatchSessionSummary | null> {
    const session = await shapeDB.getBatchSession(nodeId);
    if (!session) return null;
    return {
      nodeId: session.nodeId,
      status: mapStatus(session.status),
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt,
      progress: toProgressSummary(session.progress),
    };
  }

  async listBatchSessionRecords(nodeId: NodeId): Promise<ShapeBatchSessionRecord[]> {
    const sessions = await shapeDB.batchSessions.where('nodeId').equals(nodeId).toArray();
    return sessions.map(toShapeBatchSessionRecord);
  }

  async getBatchSessionRecord(nodeId: NodeId): Promise<ShapeBatchSessionRecord | null> {
    const session = await shapeDB.getBatchSession(nodeId);
    return session ? toShapeBatchSessionRecord(session) : null;
  }

  async listBatchSessionRecordsByStatus(
    statuses: Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>,
  ): Promise<ShapeBatchSessionRecord[]> {
    const sessions = await shapeDB.batchSessions.where('status').anyOf(statuses).toArray();
    return sessions.map(toShapeBatchSessionRecord);
  }

  async listBuildTasks(nodeId: NodeId): Promise<ShapeBuildTaskSummary[]> {
    const db = ephemeralShapeDB;
    const tasks = await db.batchTasks.where('nodeId').equals(nodeId).toArray();
    return tasks.map((task) => toTaskSummary(task as ShapeBuildTaskRecord));
  }

  async listBuildTaskRecords(nodeId: NodeId): Promise<ShapeBuildTaskRecord[]> {
    const db = ephemeralShapeDB;
    return db.batchTasks.where('nodeId').equals(nodeId).toArray() as Promise<ShapeBuildTaskRecord[]>;
  }

  async listBuildTaskRecordsByStage(nodeId: NodeId, stage: ShapeBuildStage): Promise<ShapeBuildTaskRecord[]> {
    const tasks = await this.listBuildTaskRecords(nodeId);
    return tasks.filter((task) => task.taskType === stage);
  }

  async getBuildTaskRecord(taskId: string): Promise<ShapeBuildTaskRecord | null> {
    const db = ephemeralShapeDB;
    const task = await db.batchTasks.get(taskId);
    return task ? (task as ShapeBuildTaskRecord) : null;
  }

  async getProcessingStatus(nodeId: NodeId): Promise<ShapeProcessingStatus | null> {
    const sessions = await shapeDB.batchSessions.where('nodeId').equals(nodeId).toArray();
    const latest = sessions.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
    if (!latest) {
      return {
        status: 'idle',
        hasErrors: false,
        errorMessages: [],
      };
    }
    const totalFeatures = await this.getProcessedFeatureCount(nodeId);
    const totalVectorTiles = await shapeDB.vectorTiles.where('nodeId').equals(nodeId).count();
    return {
      status: mapStatus(latest.status),
      lastProcessed: latest.completedAt ?? latest.updatedAt,
      totalFeatures,
      totalVectorTiles,
      hasErrors: latest.status === 'failed',
      errorMessages: latest.status === 'failed' ? ['Batch processing failed'] : [],
      stage: latest.progress?.taskType,
      progress: latest.progress?.percentage,
      lastUpdated: latest.updatedAt,
    };
  }

  async getProcessedFeatureCount(nodeId: NodeId): Promise<number> {
    return shapeDB.features.where('nodeId').equals(nodeId).count();
  }

  async getVectorTileInfo(nodeId: NodeId, z: number, x: number, y: number): Promise<ShapeTileInfo | null> {
    const tile = await shapeDB.getVectorTile(nodeId, z, x, y);
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

  async getVectorTileRecord(nodeId: NodeId, z: number, x: number, y: number): Promise<ShapeVectorTileRecord | null> {
    const tile = await shapeDB.getVectorTile(nodeId, z, x, y);
    return (tile as ShapeVectorTileRecord | undefined) ?? null;
  }

  async getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<Uint8Array | null> {
    const tile = await shapeDB.getVectorTile(nodeId, z, x, y);
    if (!tile) return null;
    const data = tile.data_Uint8Array;
    if (data instanceof Uint8Array) return data;
    return new Uint8Array(data);
  }

  async listVectorTiles(nodeId: NodeId): Promise<ShapeTileSummaryEntry[]> {
    const tiles = await shapeDB.vectorTiles.where('nodeId').equals(nodeId).toArray();
    return tiles.map((tile) => ({
      z: tile.z,
      x: tile.x,
      y: tile.y,
      size: tile.size,
      timestamp: tile.generatedAt,
    }));
  }

  async getVectorTileSummary(nodeId: NodeId): Promise<ShapeTileSummary> {
    const tiles = await shapeDB.vectorTiles.where('nodeId').equals(nodeId).toArray();
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

  async listFeatures(nodeId: NodeId): Promise<ShapeFeatureRecord[]> {
    return shapeDB.features.where('nodeId').equals(nodeId).toArray() as Promise<ShapeFeatureRecord[]>;
  }

  async listFeaturesInBbox(
    nodeId: NodeId,
    bbox: [number, number, number, number],
    adminLevel?: number,
  ): Promise<ShapeFeatureRecord[]> {
    return shapeDB.getFeaturesInBbox(nodeId, bbox, adminLevel) as Promise<ShapeFeatureRecord[]>;
  }

  async listFetchBuffers(nodeId: NodeId): Promise<ShapeFetchBufferRecord[]> {
    const metadata = await listRawDataDataSourceMetadataForNode(nodeId);
    const records = await Promise.all(metadata.map(async (entry) => {
      const cacheKey = entry.cacheKey;
      if (!cacheKey) return null;
      const data = await readRawDataDataSourceBuffer(nodeId, cacheKey);
      if (!data) return null;
      const summary = await summarizeDownloadBuffer(data, entry.contentType);
      return {
        id: cacheKey,
        nodeId,
        data,
        featureCount: summary.featureCount,
        bbox: summary.bbox,
        downloadTime: entry.fetchedAt ?? entry.createdAt ?? Date.now(),
        size: entry.sizeBytes ?? data.byteLength,
        timestamp: entry.updatedAt ?? entry.createdAt ?? Date.now(),
      };
    }));
    return records.filter(Boolean) as ShapeFetchBufferRecord[];
  }

  async getFetchBuffer(nodeId: NodeId, bufferId: string): Promise<ShapeFetchBufferRecord | null> {
    const data = await readRawDataDataSourceBuffer(nodeId, bufferId);
    if (!data) return null;
    const metadata = await listRawDataDataSourceMetadataForNode(nodeId);
    const entry = metadata.find((item) => item.cacheKey === bufferId);
    const summary = await summarizeDownloadBuffer(data, entry?.contentType);
    return {
      id: bufferId,
      nodeId,
      data,
      featureCount: summary.featureCount,
      bbox: summary.bbox,
      downloadTime: Date.now(),
      size: data.byteLength,
      timestamp: Date.now(),
    };
  }

  async getTransformSourceBuffer(
    bufferId: string
  ): Promise<ShapeTransformSourceBufferRecord|null> {
    return await ephemeralShapeDB.transformBuffers.get(bufferId)??null;
  }

  async listTransformSourceBuffers(
    nodeId: NodeId
  ): Promise<ShapeTransformSourceBufferRecord[]> {
    return await ephemeralShapeDB.transformBuffers.where('nodeId').equals(nodeId).toArray();
  }

  async getTransformBuffer(bufferId: string): Promise<TransformFeatureBuffer | null> {
    return (await ephemeralShapeDB.transformBuffers.get(bufferId)) ?? null;
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

export class ShapeMutationAPIImpl implements ShapeMutationAPI {
  async upsertBatchSession(session: ShapeBatchSessionRecord): Promise<void> {
    const record = toBatchSessionRecord(session);
    if (!record) {
      throw new Error('Invalid batch session config');
    }
    await shapeDB.batchSessions.put(record);
  }

  async updateBatchSession(nodeId: NodeId, updates: Partial<ShapeBatchSessionRecord>): Promise<void> {
    const patch = toBatchSessionUpdates(updates);
    if (!patch) {
      throw new Error('Invalid batch session config update');
    }
    await shapeDB.updateBatchSession(nodeId, patch);
  }

  async deleteBatchSession(nodeId: NodeId): Promise<void> {
    await shapeDB.batchSessions.delete(nodeId);
  }

  async deleteBuildTasks(nodeId: NodeId): Promise<void> {
    await ephemeralShapeDB.batchTasks.where('nodeId').equals(nodeId).delete();
  }

  async deleteVectorTile(tileId: string): Promise<void> {
    await shapeDB.vectorTiles.delete(tileId);
  }

  async deleteVectorTiles(nodeId: NodeId): Promise<void> {
    await shapeDB.vectorTiles.where('nodeId').equals(nodeId).delete();
  }

  async deleteTileBuffers(nodeId: NodeId): Promise<void> {
    await ephemeralShapeDB.tileBuffers.where('nodeId').equals(nodeId).delete();
  }

  async deleteFeatureBuffers(nodeId: NodeId): Promise<void> {
    await ephemeralShapeDB.featureBuffers.where('nodeId').equals(nodeId).delete();
  }

  async deleteFeatures(nodeId: NodeId): Promise<void> {
    await shapeDB.features.where('nodeId').equals(nodeId).delete();
  }

  async cleanupProcessingData(nodeId: NodeId): Promise<void> {
    await this.deleteBuildTasks(nodeId);
    await this.deleteBatchSession(nodeId);
    await this.deleteFeatures(nodeId);
    await this.deleteFeatureBuffers(nodeId);
    await this.deleteTileBuffers(nodeId);
    await this.deleteVectorTiles(nodeId);
    await this.clearTileIndexArtifacts(nodeId);
  }

  async clearShapeArtifacts(nodeId: NodeId): Promise<void> {
    await this.cleanupProcessingData(nodeId);
    await ephemeralShapeDB.clearNodeData(nodeId);
  }

  async upsertBuildTasks(tasks: ShapeBuildTaskRecord[]): Promise<void> {
    if (tasks.length === 0) return;
    await ephemeralShapeDB.batchTasks.bulkPut(tasks);
  }

  async updateBuildTask(taskId: string, updates: Partial<ShapeBuildTaskRecord>): Promise<void> {
    await ephemeralShapeDB.updateBatchTask(taskId, updates);
  }

  async putFetchBuffers(buffers: ShapeFetchBufferRecord[]): Promise<void> {
    if (buffers.length === 0) return;
    await Promise.all(buffers.map((buffer) => (
      storeRawDataDataSourceBufferForNode({
        nodeId: buffer.nodeId,
        cacheKey: buffer.id,
        buffer: buffer.data,
      })
    )));
  }
  async putTransformSourceBuffers(buffers: ShapeTransformSourceBufferRecord[]): Promise<void>{
    if (buffers.length === 0) return;
    await ephemeralShapeDB.transformBuffers.bulkPut(buffers);
  }

  async putSourceMetadata(rows: ShapeSourceMetadataRow[]): Promise<void> {
    if (rows.length === 0) return;
    await shapeDB.sourceMetadata.bulkPut(rows);
  }

  async deleteSourceMetadataByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await shapeDB.sourceMetadata.bulkDelete(ids);
  }

  async deleteSourceMetadataByNode(nodeId: NodeId): Promise<void> {
    await shapeDB.sourceMetadata.where('nodeId').equals(nodeId).delete();
  }

  async putFeatureMetadata(rows: ShapeFeatureMetadataRow[]): Promise<void> {
    if (rows.length === 0) return;
    await shapeDB.featureMetadata.bulkPut(rows);
  }

  async deleteFeatureMetadataByNode(nodeId: NodeId): Promise<void> {
    await shapeDB.featureMetadata.where('nodeId').equals(nodeId).delete();
  }

  async syncVectorTilesFromTilesDb(nodeId: NodeId): Promise<void> {
    void nodeId;
  }

  async storeVectorTile(tile: ShapeVectorTileRecord): Promise<void> {
    await shapeDB.storeVectorTile(toVectorTileRecord(tile));
  }

  private async clearTileIndexArtifacts(nodeId: NodeId): Promise<void> {
    void nodeId;
  }

}

export class ShapeEphemeralApiImpl implements ShapeEphemeralAPI {
  async listBuildTasks(nodeId: NodeId): Promise<ShapeBuildTaskRecord[]> {
    return ephemeralShapeDB.batchTasks.where('nodeId').equals(nodeId).toArray() as Promise<ShapeBuildTaskRecord[]>;
  }

  async listBuildTasksByStatus(nodeId: NodeId, status: ShapeBuildTaskStatus): Promise<ShapeBuildTaskRecord[]> {
    return ephemeralShapeDB.batchTasks.where('[nodeId+status]').equals([nodeId, status]).toArray() as Promise<ShapeBuildTaskRecord[]>;
  }

  async listBuildTasksByType(nodeId: NodeId, taskType: ShapeBuildStage): Promise<ShapeBuildTaskRecord[]> {
    return ephemeralShapeDB.batchTasks.where('[nodeId+taskType]').equals([nodeId, taskType]).toArray() as Promise<ShapeBuildTaskRecord[]>;
  }

  async getBuildTask(taskId: string): Promise<ShapeBuildTaskRecord | null> {
    return (await ephemeralShapeDB.batchTasks.get(taskId)) ?? null;
  }

  async countBuildTasks(nodeId: NodeId): Promise<number> {
    return ephemeralShapeDB.batchTasks.where('nodeId').equals(nodeId).count();
  }

  async putBuildTasks(tasks: ShapeBuildTaskRecord[]): Promise<void> {
    if (tasks.length === 0) return;
    await ephemeralShapeDB.batchTasks.bulkPut(tasks);
  }

  async deleteBuildTasksByNode(nodeId: NodeId): Promise<void> {
    await ephemeralShapeDB.batchTasks.where('nodeId').equals(nodeId).delete();
  }

  async deleteBuildTasksByIds(taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;
    await ephemeralShapeDB.batchTasks.bulkDelete(taskIds);
  }

  async updateBuildTask(taskId: string, updates: Partial<ShapeBuildTaskRecord>): Promise<void> {
    await ephemeralShapeDB.updateBatchTask(taskId, updates);
  }

  async listFetchBuffers(nodeId: NodeId): Promise<ShapeFetchBufferRecord[]> {
    const metadata = await listRawDataDataSourceMetadataForNode(nodeId);
    const records = await Promise.all(metadata.map(async (entry) => {
      const cacheKey = entry.cacheKey;
      if (!cacheKey) return null;
      const data = await readRawDataDataSourceBuffer(nodeId, cacheKey);
      if (!data) return null;
      const summary = await summarizeDownloadBuffer(data, entry.contentType);
      return {
        id: cacheKey,
        nodeId,
        data,
        featureCount: summary.featureCount,
        bbox: summary.bbox,
        downloadTime: entry.fetchedAt ?? entry.createdAt ?? Date.now(),
        size: entry.sizeBytes ?? data.byteLength,
        timestamp: entry.updatedAt ?? entry.createdAt ?? Date.now(),
      };
    }));
    return records.filter(Boolean) as ShapeFetchBufferRecord[];
  }

  async getFetchBuffer(nodeId: NodeId, bufferId: string): Promise<ShapeFetchBufferRecord | null> {
    const data = await readRawDataDataSourceBuffer(nodeId, bufferId);
    if (!data) return null;
    const metadata = await listRawDataDataSourceMetadataForNode(nodeId);
    const entry = metadata.find((item) => item.cacheKey === bufferId);
    const summary = await summarizeDownloadBuffer(data, entry?.contentType);
    return {
      id: bufferId,
      nodeId,
      data,
      featureCount: summary.featureCount,
      bbox: summary.bbox,
      downloadTime: Date.now(),
      size: data.byteLength,
      timestamp: Date.now(),
    };
  }

  async countFetchBuffers(nodeId: NodeId): Promise<number> {
    return countRawDataDataSourceBuffersForNode(nodeId);
  }

  async putFetchBuffer(buffer: ShapeFetchBufferRecord): Promise<void> {
    await storeRawDataDataSourceBufferForNode({
      nodeId: buffer.nodeId,
      cacheKey: buffer.id,
      buffer: buffer.data,
    });
  }

  async putFetchBuffers(buffers: ShapeFetchBufferRecord[]): Promise<void> {
    if (buffers.length === 0) return;
    await Promise.all(buffers.map((buffer) => (
      storeRawDataDataSourceBufferForNode({
        nodeId: buffer.nodeId,
        cacheKey: buffer.id,
        buffer: buffer.data,
      })
    )));
  }

  async listTransformBuffers(
    nodeId: NodeId
  ): Promise<ShapeTransformSourceBufferRecord[]> {
    return ephemeralShapeDB.transformBuffers.where('nodeId').equals(nodeId).toArray();
  }

  async getTransformBuffer(bufferId: string): Promise<TransformFeatureBuffer | null> {
    return (await ephemeralShapeDB.transformBuffers.get(bufferId)) ?? null;
  }

  async countTransformBuffers(nodeId: NodeId): Promise<number> {
    return ephemeralShapeDB.transformBuffers.where('nodeId').equals(nodeId).count();
  }

  async putTransformBuffer(buffer: ShapeTransformSourceBufferRecord): Promise<void> {
    await ephemeralShapeDB.transformBuffers.put(buffer);
  }

  async putTransformBuffers(buffers: ShapeTransformSourceBufferRecord[]): Promise<void> {
    if (buffers.length === 0) return;
    await ephemeralShapeDB.transformBuffers.bulkPut(buffers);
  }

  async countVectorTiles(nodeId: NodeId): Promise<number> {
    return ephemeralShapeDB.vectorTileSourceBuffers.where('nodeId').equals(nodeId).count();
  }

  async listTileIdRelations(nodeId: NodeId): Promise<ShapeTileIdToBufferRelation[]> {
    return ephemeralShapeDB.tileIdToBufferRelations.where('nodeId').equals(nodeId).toArray() as Promise<ShapeTileIdToBufferRelation[]>;
  }

  async listTileIdRelationsByTileId(nodeId: NodeId, tileId: string): Promise<ShapeTileIdToBufferRelation[]> {
    return ephemeralShapeDB.tileIdToBufferRelations
      .where('[nodeId+tileId]')
      .equals([nodeId, tileId])
      .toArray() as Promise<ShapeTileIdToBufferRelation[]>;
  }

  async putTileIdRelations(relations: ShapeTileIdToBufferRelation[]): Promise<void> {
    if (relations.length === 0) return;
    await ephemeralShapeDB.tileIdToBufferRelations.bulkPut(relations);
  }

  async deleteTileIdRelations(nodeId: NodeId): Promise<void> {
    await ephemeralShapeDB.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
  }

  async getGeojsonVtIndex(nodeId: NodeId, bufferId: string): Promise<ShapeGeojsonVtIndexRecord | null> {
    const record = await ephemeralShapeDB.geojsonVtIndexes
      .where('[nodeId+bufferId]')
      .equals([nodeId, bufferId])
      .first();
    return (record as ShapeGeojsonVtIndexRecord | undefined) ?? null;
  }

  async putGeojsonVtIndex(record: ShapeGeojsonVtIndexRecord): Promise<void> {
    await ephemeralShapeDB.geojsonVtIndexes.put(record);
  }

  async getSessionRecord(nodeId: NodeId): Promise<ShapeEphemeralSessionRecord | null> {
    return (await ephemeralShapeDB.sessions.get(nodeId)) ?? null;
  }

  async deleteFeatureBuffers(nodeId: NodeId): Promise<void> {
    await ephemeralShapeDB.featureBuffers.where('nodeId').equals(nodeId).delete();
  }

  async deleteTileBuffers(nodeId: NodeId): Promise<void> {
    await ephemeralShapeDB.tileBuffers.where('nodeId').equals(nodeId).delete();
  }

  async hasStageData(nodeId: NodeId, stage: ShapeBuildStage): Promise<boolean> {
    return ephemeralShapeDB.hasStageData(nodeId, stage);
  }

  async clearStage(nodeId: NodeId, stage: ShapeBuildStage): Promise<void> {
    await ephemeralShapeDB.clearStage(nodeId, stage);
    if (stage === 'fetch') {
      try {
        const store = createShapeChunkStore(bufferSerializer, bufferDeserializer);
        await store.deleteAllForNode(nodeId);
      } catch (error) {
        console.warn('[shapeBatchAPI] failed to clear download chunk-store entries', error);
      }
    }
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await ephemeralShapeDB.clearNodeData(nodeId);
  }

  async clearAll(): Promise<void> {
    await ephemeralShapeDB.clearAll();
  }

  async getNumBuffers(): Promise<{
    numFetchBuffers: number;
    numTransformBuffers: number;
    numVTBuffers: number;
    numSessions: number;
    totalSize: number;
  }> {
    return ephemeralShapeDB.getNumBuffers();
  }
}

/*
const createShapeDbApiClient = () => ({
  query: new LocalShapeQueryApi(),
  mutation: new LocalShapeMutationApi(),
  ephemeral: new ShapeEphemeralDBAPIImpl(),
});

let cachedShapeDbApiClient: ReturnType<typeof createShapeDbApiClient> | null = null;
export const getShapeDbApiClient = (): ReturnType<typeof createShapeDbApiClient> => {
  if (!cachedShapeDbApiClient) {
    cachedShapeDbApiClient = createShapeDbApiClient();
  }
  return cachedShapeDbApiClient;
};

export const createShapeBatchApiClient = (): { query: ShapeQueryAPI; mutation: ShapeMutationAPI } => {
  const { query, mutation } = getShapeDbApiClient();
  return { query, mutation };
};
 */

export const shapeQueryAPIImpl = new ShapeQueryAPIImpl();
export const shapeMutationAPIImpl = new ShapeMutationAPIImpl();
export const shapeEphemeralAPIImpl = new ShapeEphemeralApiImpl();

