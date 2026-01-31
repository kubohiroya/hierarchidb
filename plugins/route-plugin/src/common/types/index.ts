import type { TreeNodeUpdaterPayload } from '@hierarchidb/tree-api';
import type { RouteEntity } from '@hierarchidb/route-store';
export type RouteUpdaterPayload = TreeNodeUpdaterPayload<RouteEntity>;
export type TagId = string;
