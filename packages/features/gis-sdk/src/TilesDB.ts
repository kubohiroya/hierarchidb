import { getDBName, SingletonMixin } from '@hierarchidb/util';
import { Dexie, type Table } from 'dexie';

export interface TileRow {
  key: string; // `${sessionId}-${z}-${x}-${y}`
  sessionId: string;
  z: number;
  x: number;
  y: number;
  data: ArrayBuffer;
  size: number;
  contentType: 'application/vnd.mapbox-vector-tile';
  timestamp: number;
}

export interface FeatureMetadataRow {
  id: string; // `${sessionId}-${featureId}`
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

export class TilesDB extends Dexie {
  tiles!: Table<TileRow, string>;
  featureMetadata!: Table<FeatureMetadataRow, string>;

  static async getSingleton(): Promise<TilesDB> {
    return SingletonMixin.getSingleton(TilesDB.name, async () => {
      const db = new TilesDB(getDBName('stage-tiles-db'));
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
