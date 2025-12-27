/**
 * @file RouteDatabase.ts
 * @description Database schema and operations for Route plugin
 */

import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';

import { RouteLineString } from '@hierarchidb/route-plugin/common/entities/RouteLineString.ts';

export class RouteDatabase extends Dexie {
  lineStrings!: Table<RouteLineString, NodeId>;

  constructor(dbName: string = getDBName('route-db')) {
    super(dbName);
    this.version(7).stores({
      lineStrings: '&id, nodeId, startLocationId, endLocationId, transportMode, [startLocationId+endLocationId], processingStatus, createdAt, updatedAt',
    });

    this.lineStrings = this.table('lineStrings');
  }

}
