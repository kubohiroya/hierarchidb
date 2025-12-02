import type { TreeNodeUpdaterPayload } from '@hierarchidb/common-types';

import type { RouteEntity } from '../entities/RouteEntity.js';
export { ROUTE_TYPES } from '../entities/RouteEntity.js';
export type {
  RouteCategory,
  RouteEntity,
  RouteFilterCriteria,
  RouteGenerationConfig,
  RouteGenerationMethod,
  RouteGenerationOptions,
  RoutePoint,
  RouteStatistics,
  RouteType,
  TransportMode,
} from '../entities/RouteEntity.js';

export type RouteDraft = TreeNodeUpdaterPayload<RouteEntity>;
export type RouteDraftPayload = RouteDraft;
export type TagId = string;
