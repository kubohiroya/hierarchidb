import type { RouteNearestLineQuery, RouteNearestLineResponse } from './routeTypes.js';

/**
 * Exposes route plugin artifacts.
 * Data is persisted independently and is not yet tied to TreeNode lifecycle events.
 */
export interface RouteQueryAPI {
  findNearestRouteLine(query: RouteNearestLineQuery): Promise<RouteNearestLineResponse>;
  getVectorTile(sessionId: string, z: number, x: number, y: number): Promise<ArrayBuffer | null>;
}
