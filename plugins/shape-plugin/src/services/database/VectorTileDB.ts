import { Dexie, type Table } from 'dexie';
import { getDBName, SingletonMixin } from '@hierarchidb/util';

export interface StageTileRow {
  key: string;
  nodeId: string;
  z: number;
  x: number;
  y: number;
  data: ArrayBuffer;
  size: number;
  contentType: string;
  timestamp: number;
}

export interface ShapeFeatureMetadataRow {
  id: string;
  nodeId: string;
  featureId: string;
  countryName?: string;
  countryCode?: string;
  adminName?: string;
  adminLevel?: number;
  adminCode?: string;
  dataSource?: string;
  createdAt: number;
  vertexCount: number;
  polygonCount: number;
  bbox?: [number, number, number, number];
  area: number;
}

export interface ShapeSourceMetadataRow {
  id: string;
  nodeId: string;
  originKey: string;
  originLabel: string;
  dataSource?: string;
  countryName?: string;
  countryCode?: string;
  continent?: string;
  adminLevel?: number;
  featureGroupId?: string;
  featureLabel?: string;
  createdAt: number;
  updatedAt: number;
  rawVertexCount?: number;
  rawPolygonCount?: number;
  extract1VertexCount?: number;
  extract1PolygonCount?: number;
  extract2VertexCount?: number;
  extract2PolygonCount?: number;
  vectorTileVertexCount?: number;
  vectorTilePolygonCount?: number;
  bbox?: [number, number, number, number];
}

export class VectorTileDB extends Dexie {
  tiles!: Table<StageTileRow, string>;
  featureMetadata!: Table<ShapeFeatureMetadataRow, string>;
  sourceMetadata!: Table<ShapeSourceMetadataRow, string>;

  static async getSingleton(): Promise<VectorTileDB> {
    return SingletonMixin.getSingleton('ShapeTileMetadataDB', async () => {
      const db = new VectorTileDB(getDBName('vectortile'));
      await db.open();
      return db;
    });
  }

  private constructor(name: string) {
    super(name);
    this.version(4).stores({
      tiles: '&key, nodeId, [nodeId+z+x+y], z, x, y, timestamp',
      featureMetadata:
        '&id, nodeId, featureId, countryCode, adminLevel, adminCode, dataSource, createdAt',
      sourceMetadata:
        '&id, nodeId, originKey, dataSource, countryCode, adminLevel, createdAt, updatedAt',
    });
    this.tiles = this.table('tiles');
    this.featureMetadata = this.table('featureMetadata');
    this.sourceMetadata = this.table('sourceMetadata');
  }
}

export async function getShapeTileMetadataDB(): Promise<VectorTileDB> {
  return VectorTileDB.getSingleton();
}
