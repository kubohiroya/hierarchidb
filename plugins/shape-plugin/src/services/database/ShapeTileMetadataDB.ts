import { Dexie, type Table } from 'dexie';
import { getDBName, SingletonMixin } from '@hierarchidb/util';

export interface StageTileRow {
  key: string;
  sessionId: string;
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
  sessionId: string;
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

export class ShapeTileMetadataDB extends Dexie {
  tiles!: Table<StageTileRow, string>;
  featureMetadata!: Table<ShapeFeatureMetadataRow, string>;

  static async getSingleton(): Promise<ShapeTileMetadataDB> {
    return SingletonMixin.getSingleton(ShapeTileMetadataDB.name, async () => {
      const db = new ShapeTileMetadataDB(getDBName('stage-tiles-db'));
      await db.open();
      return db;
    });
  }

  private constructor(name: string) {
    super(name);
    this.version(1).stores({
      tiles: '&key, sessionId, [sessionId+z+x+y], z, x, y, timestamp',
    });
    this.version(2).stores({
      tiles: '&key, sessionId, [sessionId+z+x+y], z, x, y, timestamp',
      featureMetadata:
        '&id, sessionId, featureId, countryCode, adminLevel, adminCode, dataSource, createdAt',
    });
    this.tiles = this.table('tiles');
    this.featureMetadata = this.table('featureMetadata');
  }
}

export async function getShapeTileMetadataDB(): Promise<ShapeTileMetadataDB> {
  return ShapeTileMetadataDB.getSingleton();
}
