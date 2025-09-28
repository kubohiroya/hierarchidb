import { Dexie, type Table } from 'dexie';
import { getDBName, SingletonMixin } from '@hierarchidb/util';

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

export class TilesDB extends Dexie {
  tiles!: Table<TileRow, string>;

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
    this.tiles = this.table('tiles');
  }
}
