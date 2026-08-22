import type { NodeId } from '@hierarchidb/core-types';
import type { RouteFeature } from '@hierarchidb/route-api';
import type { RouteTileIndexRecord, RouteVectorTileRecord } from './RouteDB.js';

export type RouteDatabaseHandle = {
  open?: () => Promise<unknown>;
  close?: () => void;
  features: {
    where: (key: string) => {
      equals: (value: NodeId) => {
        toArray: () => Promise<RouteFeature[]>;
        delete?: () => Promise<number>;
      };
    };
    bulkPut?: (items: RouteFeature[]) => Promise<unknown>;
    bulkGet?: (keys: NodeId[]) => Promise<Array<RouteFeature | undefined>>;
  };
  vectorTiles: {
    where: (key: string) => {
      equals: (value: NodeId | [NodeId, number, number, number]) => {
        toArray: () => Promise<RouteVectorTileRecord[]>;
        delete?: () => Promise<number>;
      };
    };
    bulkPut?: (items: RouteVectorTileRecord[]) => Promise<unknown>;
    bulkDelete?: (keys: string[]) => Promise<unknown>;
    get?: (key: string) => Promise<RouteVectorTileRecord | undefined>;
  };
  tileIndex: {
    where: (key: string) => {
      equals: (value: NodeId | [NodeId, number, number, number]) => {
        toArray: () => Promise<RouteTileIndexRecord[]>;
        delete?: () => Promise<number>;
      };
    };
    bulkPut?: (items: RouteTileIndexRecord[]) => Promise<unknown>;
  };
};
