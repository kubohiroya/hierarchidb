import { Dexie, type Table } from 'dexie';
import type { ShapeFeatureMetadata, ShapeDataSourceMetadata } from '@hierarchidb/shape-api';

export type FeatureMetadataRow = ShapeFeatureMetadata;
export type DataSourceMetadataRow = ShapeDataSourceMetadata;

export class VectorTileDbBase extends Dexie {
  featureMetadata!: Table<FeatureMetadataRow, string>;
  dataSourceMetadata!: Table<DataSourceMetadataRow, string>;

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
    this.dataSourceMetadata = this.table('sourceMetadata');
  }
}
