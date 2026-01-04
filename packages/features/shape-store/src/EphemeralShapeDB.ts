import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type { Table } from 'dexie';
import type { BatchProcessConfig } from './ShapeDB.js';
import type { FeatureBufferRecord, TileBufferRecord } from './ShapeDB.js';
import {
  EphemeralGisDB,
  type BatchSessionMetadata as BaseBatchSessionMetadata,
  type EphemeralStage as BaseEphemeralStage,
  type ProcessingCache as BaseProcessingCache,
  type RawFeatureBuffer as BaseRawFeatureBuffer,
  type ExtractedFeatureBuffer as BaseExtractedFeatureBuffer,
  type VectorTileData as BaseVectorTileData,
} from '@hierarchidb/gis-sdk';

export type RawFeatureBuffer = BaseRawFeatureBuffer;
export type ExtractedFeatureBuffer = BaseExtractedFeatureBuffer;
export type VectorTileData = BaseVectorTileData;
export type EphemeralStage = BaseEphemeralStage;
export type ProcessingCache = BaseProcessingCache;
export type BatchSessionMetadata = BaseBatchSessionMetadata<BatchProcessConfig>;
export type TileIdToBufferRelation = {
  id: string;
  nodeId: NodeId;
  tileId: string;
  bufferId: string;
  createdAt: number;
};

export class EphemeralShapeDB extends EphemeralGisDB<BatchProcessConfig> {
  featureBuffers!: Table<FeatureBufferRecord, string>;
  tileBuffers!: Table<TileBufferRecord, string>;
  tileIdToBufferRelations!: Table<TileIdToBufferRelation, string>;

  constructor() {
    super(getDBName('shape-ephemeral'));
    this.version(3).stores({
      rawBuffers: '&id, nodeId, timestamp',
      extractedBuffers: '&id, nodeId, stage, timestamp, [nodeId+stage]',
      vectorTiles: '&id, nodeId, [z+x+y], hash, timestamp',
      sessions: '&nodeId, status, stage, startTime',
      cache: '&key, type, lastAccessed, ttl',
      featureBuffers: '&bufferId, nodeId, [nodeId+stage], stage, createdAt, byteSize',
      tileBuffers: '&bufferId, nodeId, [nodeId+z+x+y], [z+x+y], z, stage, createdAt',
    });
    this.version(4).stores({
      rawBuffers: '&id, nodeId, timestamp',
      extractedBuffers: '&id, nodeId, stage, timestamp, [nodeId+stage]',
      vectorTiles: '&id, nodeId, [z+x+y], hash, timestamp',
      sessions: '&nodeId, status, stage, startTime',
      cache: '&key, type, lastAccessed, ttl',
      featureBuffers: '&bufferId, nodeId, [nodeId+stage], stage, createdAt, byteSize',
      tileBuffers: '&bufferId, nodeId, [nodeId+z+x+y], [z+x+y], z, stage, createdAt',
      tileIdToBufferRelations: '&id, nodeId, tileId, bufferId, [nodeId+tileId]',
    });
    this.featureBuffers = this.table('featureBuffers');
    this.tileBuffers = this.table('tileBuffers');
    this.tileIdToBufferRelations = this.table('tileIdToBufferRelations');
  }

  async clearNodeData(nodeId: NodeId): Promise<void> {
    await super.clearNodeData(nodeId);
    await this.featureBuffers.where('nodeId').equals(nodeId).delete();
    await this.tileBuffers.where('nodeId').equals(nodeId).delete();
    await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
  }

  async clearStage(nodeId: NodeId, stage: BaseEphemeralStage): Promise<void> {
    await super.clearStage(nodeId, stage);
    await this.featureBuffers.where('[nodeId+stage]').equals([nodeId, stage]).delete();
    await this.tileBuffers.where('nodeId').equals(nodeId).and((entry) => entry.stage === stage).delete();
    if (stage === 'extract2') {
      await this.tileIdToBufferRelations.where('nodeId').equals(nodeId).delete();
    }
  }

  async clearAll(): Promise<void> {
    await super.clearAll();
    await this.featureBuffers.clear();
    await this.tileBuffers.clear();
    await this.tileIdToBufferRelations.clear();
  }
}

let ephemeralDBInstance: EphemeralShapeDB | null = null;

export function getEphemeralShapeDB(): EphemeralShapeDB {
  if (!ephemeralDBInstance) {
    ephemeralDBInstance = new EphemeralShapeDB();
  }
  return ephemeralDBInstance;
}

export async function closeEphemeralShapeDB(): Promise<void> {
  if (ephemeralDBInstance) {
    await ephemeralDBInstance.close();
    ephemeralDBInstance = null;
  }
}
