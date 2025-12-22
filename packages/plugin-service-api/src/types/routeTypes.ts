import type { NodeId } from '@hierarchidb/common-types';

export interface RouteResultPayload {
  name?: string;
  coordinates?: [number, number];
  payload?: Record<string, unknown>;
}

export interface RouteResultItem {
  id: string;
  routeId?: NodeId;
  sessionId: string;
  taskId: string;
  method: string;
  lineGeometry?: [number, number][];
  distance?: number;
  duration?: number;
  createdAt: number;
  result?: RouteResultPayload;
}
