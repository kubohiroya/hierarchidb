import { SingletonMixin } from '@hierarchidb/util';
import type { NodeId } from '@hierarchidb/common-types';
import type { RouteMutationAPI } from '@hierarchidb/plugin-service-api';

type DexieCollection = {
  delete?: () => Promise<number>;
};

type DexieWhere = {
  equals(value: unknown): DexieCollection;
};

type DexieTable = {
  where(key: string): DexieWhere;
  delete?: (id: string) => Promise<void>;
};

type RouteDatabaseLike = {
  open?: () => Promise<unknown>;
  routeResults: DexieTable;
  routeCache: DexieTable;
  routeCursors: DexieTable;
  pendingSessions: DexieTable;
};

export class RouteMutationService implements RouteMutationAPI {
  static async getSingleton(db: RouteDatabaseLike): Promise<RouteMutationService> {
    return SingletonMixin.getSingleton('RouteMutationService', async () => new RouteMutationService(db));
  }

  constructor(private db: RouteDatabaseLike) {}

  private async ensureOpen(): Promise<void> {
    await this.db.open?.();
  }

  async deleteRouteResults(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.routeResults.where('routeId').equals(nodeId).delete?.();
  }

  async deleteRouteCache(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.routeCache.where('routeId').equals(nodeId).delete?.();
  }

  async deleteRouteCursors(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.routeCursors.where('nodeId').equals(nodeId).delete?.();
  }

  async deletePendingSessions(nodeId: NodeId): Promise<void> {
    await this.ensureOpen();
    await this.db.pendingSessions.where('nodeId').equals(nodeId).delete?.();
  }
}
