import { SingletonMixin } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type { RouteQueryAPI, RouteResultItem } from '@hierarchidb/plugin-service-api';
import { RouteDatabase } from '@hierarchidb/route-plugin/database';

export class RouteQueryService implements RouteQueryAPI {
  static async getSingleton(db: RouteDatabase): Promise<RouteQueryService> {
    return SingletonMixin.getSingleton(RouteQueryService.name, async () => new RouteQueryService(db));
  }

  constructor(private db: RouteDatabase) {}

  async listRouteResults(nodeId: NodeId): Promise<RouteResultItem[]> {
    await this.db.open?.();
    const rows = await this.db.routeResults.where('routeId').equals(nodeId).toArray();
    return rows as RouteResultItem[];
  }
}
