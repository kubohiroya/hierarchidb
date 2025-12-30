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
  adminLevel?: number;
  featureGroupId?: string;
  featureLabel?: string;
  createdAt: number;
  updatedAt: number;
  rawVertexCount?: number;
  rawPolygonCount?: number;
  simplify1VertexCount?: number;
  simplify1PolygonCount?: number;
  simplify2VertexCount?: number;
  simplify2PolygonCount?: number;
  vectorTileVertexCount?: number;
  vectorTilePolygonCount?: number;
  bbox?: [number, number, number, number];
}

export class ShapeTileMetadataDB extends Dexie {
  tiles!: Table<StageTileRow, string>;
  featureMetadata!: Table<ShapeFeatureMetadataRow, string>;
  sourceMetadata!: Table<ShapeSourceMetadataRow, string>;

  static async getSingleton(): Promise<ShapeTileMetadataDB> {
    return SingletonMixin.getSingleton('ShapeTileMetadataDB', async () => {
      const db = new ShapeTileMetadataDB(getDBName('vectortile'));
      await db.open();
      return db;
    });
  }

  private constructor(name: string) {
    super(name);
    this.version(2).stores({
      tiles: '&key, sessionId, [sessionId+z+x+y], z, x, y, timestamp',
      featureMetadata:
        '&id, sessionId, featureId, countryCode, adminLevel, adminCode, dataSource, createdAt',
    });
    this.version(3)
      .stores({
        tiles: '&key, nodeId, [nodeId+z+x+y], z, x, y, timestamp',
        featureMetadata:
          '&id, nodeId, featureId, countryCode, adminLevel, adminCode, dataSource, createdAt',
        sourceMetadata:
          '&id, nodeId, originKey, dataSource, countryCode, adminLevel, createdAt, updatedAt',
      })
      .upgrade(async () => {
        await this.table('tiles').clear();
        await this.table('featureMetadata').clear();
      });
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

export async function getShapeTileMetadataDB(): Promise<ShapeTileMetadataDB> {
  return ShapeTileMetadataDB.getSingleton();
}
