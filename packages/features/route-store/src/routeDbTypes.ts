import type { NodeId } from '@hierarchidb/common-types';
import type { RouteVectorTileRecord } from './RouteDB.js';
import type { RouteFeature } from './routeTypes.js';

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
};
