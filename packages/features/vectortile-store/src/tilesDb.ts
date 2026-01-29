import { Dexie, type Table } from 'dexie';
import type { ShapeFeatureMetadata, ShapeSourceMetadata } from '@hierarchidb/plugin-service-api';

export type FeatureMetadataRow = ShapeFeatureMetadata;
export type SourceMetadataRow = ShapeSourceMetadata;

export class VectorTileDbBase extends Dexie {
  featureMetadata!: Table<FeatureMetadataRow, string>;
  sourceMetadata!: Table<SourceMetadataRow, string>;

  protected mergeVectorTileStores(stores: Record<string, string>): Record<string, string> {
    return {
      ...stores,
      featureMetadata:
        '&id, nodeId, featureId, countryCode, adminLevel, adminCode, dataSource, createdAt',
      sourceMetadata:
        '&id, nodeId, originKey, dataSource, countryCode, adminLevel, createdAt, updatedAt',
    };
  }

  protected initVectorTileTables(): void {
    this.featureMetadata = this.table('featureMetadata');
    this.sourceMetadata = this.table('sourceMetadata');
  }
}
