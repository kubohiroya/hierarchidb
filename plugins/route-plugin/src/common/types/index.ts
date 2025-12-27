import type { TreeNodeUpdaterPayload } from '@hierarchidb/common-types';

import type { RouteEntity } from '../entities/RouteEntity.js';
export type {
  //RouteCategory,
  RouteEntity,
  //RouteFilterCriteria,
  //RouteGenerationConfig,
  //RouteGenerationMethod,
  //RouteGenerationOptions,
  //RouteStatistics,

  //TransportMode,

} from '../entities/RouteEntity.js';
export type { BatchConfig, RouteBatchConfig } from './BatchConfig.js';

export type RouteUpdaterPayload = TreeNodeUpdaterPayload<RouteEntity>;
export type TagId = string;
export type { RouteLineString, RoutePoint, RouteMode } from '../entities/RouteLineString.js';
export { ROUTE_MODES } from '../entities/RouteLineString.js';
