// Test-only worker entry that exposes WorkerService over a MessagePort/Comlink endpoint.
// Runs in the same process for simplicity; fake-indexeddb provides IndexedDB in Node.
import 'fake-indexeddb/auto';
import type { ImportExportAPI } from '@hierarchidb/import-export-api';
import type { TreeTableExpandedAPI, TreeNodeData } from '@hierarchidb/tree-api';
import type {
  TreeMutationAPI,
  TreeNodeUpdaterAPI,
  TreeQueryAPI,
  TreeSubscriptionAPI,
} from '@hierarchidb/tree-api';
import type { LocationMutationAPI, LocationQueryAPI } from '@hierarchidb/location-api';
import type { StyleMutationAPI, StyleQueryAPI } from '@hierarchidb/style-api';
import type { RouteMutationAPI, RouteQueryAPI } from '@hierarchidb/route-api';
import type { ShapeMutationAPI, ShapeQueryAPI } from '@hierarchidb/shape-api';
import type { Endpoint as ComlinkEndpoint } from 'comlink';
import { expose, proxy } from 'comlink';
import type { CommandProcessor } from '~/services/CommandProcessor';
import { WorkerService } from '~/WorkerService';

type Endpoint = MessagePort | Worker | ComlinkEndpoint;

async function main(endpoint?: Endpoint): Promise<void> {
  const svc = await WorkerService.getSingleton([], {
    assertYamlStorageCanonicalAccess: () => {},
  });
  // No per-API facades; return Comlink proxies of service instances directly

  const api = {
    ping: (): { response: string; timestamp: number } => svc.ping(),
    getQueryAPI: (): TreeQueryAPI => proxy(svc.getQueryAPI()),
    getMutationAPI: (): TreeMutationAPI => proxy(svc.getMutationAPI()),
    getSubscriptionAPI: (): TreeSubscriptionAPI => proxy(svc.getSubscriptionAPI()),
    getImportExportAPI: (): ImportExportAPI<TreeNodeData> => proxy(svc.getImportExportAPI()),
    getTreeNodeUpdaterAPI: (): TreeNodeUpdaterAPI<TreeNodeData> =>
      proxy(svc.getTreeNodeUpdaterAPI()),
    getTreeTableExpandedAPI: (): TreeTableExpandedAPI => proxy(svc.getTreeTableExpandedAPI()),
    getStyleQueryAPI: (): StyleQueryAPI => proxy(svc.getStyleQueryAPI()),
    getStyleMutationAPI: (): StyleMutationAPI => proxy(svc.getStyleMutationAPI()),
    getShapeQueryAPI: (): ShapeQueryAPI => proxy(svc.getShapeQueryAPI()),
    getShapeMutationAPI: (): ShapeMutationAPI => proxy(svc.getShapeMutationAPI()),
    getLocationQueryAPI: (): LocationQueryAPI => proxy(svc.getLocationQueryAPI()),
    getLocationMutationAPI: (): LocationMutationAPI => proxy(svc.getLocationMutationAPI()),
    getRouteQueryAPI: (): RouteQueryAPI => proxy(svc.getRouteQueryAPI()),
    getRouteMutationAPI: (): RouteMutationAPI => proxy(svc.getRouteMutationAPI()),
    getCommandProcessor: (): CommandProcessor => proxy(svc.getCommandProcessor()),
  };
  // When used in-process via MessageChannel, a test passes an explicit endpoint.
  // If no endpoint is provided (real worker case), expose on self.
  if (endpoint) {
    expose(api, endpoint);
  } else {
    expose(api);
  }
}

// Allow direct import/execute in tests
export { main as exposeTestAPI };
