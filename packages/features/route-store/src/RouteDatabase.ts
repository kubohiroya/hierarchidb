/**
 * @file RouteDatabase.ts
 * @description Database schema and operations for Route plugin
 */

import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';

import type { RouteLineString } from './index.js';

export type RouteVectorTileRecord = {
  tileId: string;
  nodeId: NodeId;
  z: number;
  x: number;
  y: number;
  data: ArrayBuffer;
  size: number;
  contentType: 'application/vnd.mapbox-vector-tile';
  timestamp: number;
};

export class RouteDB extends Dexie {
  features!: Table<RouteLineString, NodeId>;
  vectorTiles!: Table<RouteVectorTileRecord, string>;

  constructor(dbName: string = getDBName('route')) {
    super(dbName);
    this.version(1).stores({
      features:
        '&id, nodeId, startLocationId, endLocationId, transportMode, [startLocationId+endLocationId], processingStatus, createdAt, updatedAt',
      vectorTiles: '&tileId, nodeId, [nodeId+z+x+y], z, timestamp',
    });

    this.features = this.table('features');
    this.vectorTiles = this.table('vectorTiles');
  }

}
