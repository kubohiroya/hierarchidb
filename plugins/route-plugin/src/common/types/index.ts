import type { RouteEntity } from '@hierarchidb/route-store';
import type { TreeNodeUpdaterPayload } from '@hierarchidb/tree-api';
export type RouteUpdaterPayload = TreeNodeUpdaterPayload<RouteEntity>;
export type TagId = string;
