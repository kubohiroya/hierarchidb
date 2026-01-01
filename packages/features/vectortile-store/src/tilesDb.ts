import { Dexie, type Table } from 'dexie';
import { getDBName, SingletonMixin } from '@hierarchidb/util';

export interface TileRow {
  key: string; // `${nodeId}-${z}-${x}-${y}`
  nodeId: string;
  z: number;
  x: number;
  y: number;
  data: ArrayBuffer;
  size: number;
  contentType: 'application/vnd.mapbox-vector-tile';
  timestamp: number;
}

export interface FeatureMetadataRow {
  id: string; // `${nodeId}-${featureId}`
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

export interface SourceMetadataRow {
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

export class TilesDB extends Dexie {
  tiles!: Table<TileRow, string>;
  featureMetadata!: Table<FeatureMetadataRow, string>;
  sourceMetadata!: Table<SourceMetadataRow, string>;

  static async getSingleton(): Promise<TilesDB> {
    return SingletonMixin.getSingleton('TilesDB', async () => {
      const db = new TilesDB(getDBName('vectortile'));
      await db.open();
      return db;
    });
  }

  private constructor(name: string) {
    super(name);
    this.version(1).stores({
      tiles: '&key, nodeId, [nodeId+z+x+y], z, x, y, timestamp',
    });
    this.version(2).stores({
      tiles: '&key, nodeId, [nodeId+z+x+y], z, x, y, timestamp',
      featureMetadata:
        '&id, nodeId, featureId, countryCode, adminLevel, adminCode, dataSource, createdAt',
    });
    this.version(3).stores({
      tiles: '&key, nodeId, [nodeId+z+x+y], z, x, y, timestamp',
      featureMetadata:
        '&id, nodeId, featureId, countryCode, adminLevel, adminCode, dataSource, createdAt',
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

