import { Dexie, type Table } from 'dexie';
import type { ShapeFeatureMetadataRow, ShapeSourceMetadataRow } from '@hierarchidb/plugin-service-api';

export type FeatureMetadataRow = ShapeFeatureMetadataRow;
export type SourceMetadataRow = ShapeSourceMetadataRow;

export type ZoomRange = { zMin: number; zMax: number };

export interface SourceRow {
  id: string;
  filePath: string;
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface TileIndexRow {
  z: number;
  tileId: number;
  sourceId: string;
}

export interface MetaRow {
  key: 'zoomRange';
  value: ZoomRange;
}

export class VectorTileDbBase extends Dexie {
  featureMetadata!: Table<FeatureMetadataRow, string>;
  sourceMetadata!: Table<SourceMetadataRow, string>;
  meta!: Table<MetaRow, 'zoomRange'>;
  sources!: Table<SourceRow, string>;
  tileIndex!: Table<TileIndexRow, [number, number, string]>;

  protected mergeVectorTileStores(stores: Record<string, string>): Record<string, string> {
    return {
      ...stores,
      featureMetadata:
        '&id, nodeId, featureId, countryCode, adminLevel, adminCode, dataSource, createdAt',
      sourceMetadata:
        '&id, nodeId, originKey, dataSource, countryCode, adminLevel, createdAt, updatedAt',
      meta: '&key',
      sources: '&id',
      tileIndex: '&[z+tileId+sourceId], [z+tileId], sourceId',
    };
  }

  protected initVectorTileTables(): void {
    this.featureMetadata = this.table('featureMetadata');
    this.sourceMetadata = this.table('sourceMetadata');
    this.meta = this.table('meta');
    this.sources = this.table('sources');
    this.tileIndex = this.table('tileIndex');
  }
}
