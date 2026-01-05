import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeExtractSourceBufferRecord,
  ShapeFeatureMetadataRow,
  ShapeMutationAPI,
  ShapeQueryAPI,
  ShapeRawBufferRecord,
  ShapeSourceMetadataRow,
  ShapeTileRow,
} from '@hierarchidb/plugin-service-api';

export class SessionArtifactStore {
  constructor(
    private readonly nodeId: NodeId,
    private readonly queryApi: ShapeQueryAPI,
    private readonly mutationApi: ShapeMutationAPI,
  ) {}

  listRawBuffers(): Promise<ShapeRawBufferRecord[]> {
    return this.queryApi.listRawBuffers(this.nodeId);
  }

  getRawBuffer(bufferId: string): Promise<ShapeRawBufferRecord | null> {
    return this.queryApi.getRawBuffer(this.nodeId, bufferId);
  }

  putRawBuffers(buffers: ShapeRawBufferRecord[]): Promise<void> {
    return this.mutationApi.putRawBuffers(buffers);
  }

  listExtractedBuffers(stage?: 'extract1' | 'extract2'): Promise<ShapeExtractSourceBufferRecord[]> {
    return this.queryApi.listExtractedBuffers(this.nodeId, stage);
  }

  getExtractedBuffer(bufferId: string): Promise<ShapeExtractSourceBufferRecord | null> {
    return this.queryApi.getExtractedBuffer(bufferId);
  }

  putExtractedBuffers(buffers: ShapeExtractSourceBufferRecord[]): Promise<void> {
    return this.mutationApi.putExtractedBuffers(buffers);
  }

  listVectorTileRows(): Promise<ShapeTileRow[]> {
    return this.queryApi.listVectorTileRows(this.nodeId);
  }

  listSourceMetadata(): Promise<ShapeSourceMetadataRow[]> {
    return this.queryApi.listSourceMetadata(this.nodeId);
  }

  putSourceMetadata(rows: ShapeSourceMetadataRow[]): Promise<void> {
    return this.mutationApi.putSourceMetadata(rows);
  }

  deleteSourceMetadataByIds(ids: string[]): Promise<void> {
    return this.mutationApi.deleteSourceMetadataByIds(ids);
  }

  deleteSourceMetadataByNode(): Promise<void> {
    return this.mutationApi.deleteSourceMetadataByNode(String(this.nodeId));
  }

  listFeatureMetadata(): Promise<ShapeFeatureMetadataRow[]> {
    return this.queryApi.listFeatureMetadata(this.nodeId);
  }

  putFeatureMetadata(rows: ShapeFeatureMetadataRow[]): Promise<void> {
    return this.mutationApi.putFeatureMetadata(rows);
  }

  deleteFeatureMetadataByNode(): Promise<void> {
    return this.mutationApi.deleteFeatureMetadataByNode(String(this.nodeId));
  }

  syncVectorTilesToShapeStore(): Promise<void> {
    return this.mutationApi.syncVectorTilesFromTilesDb(this.nodeId);
  }
}
