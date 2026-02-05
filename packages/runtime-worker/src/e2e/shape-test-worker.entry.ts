// Test-only worker entry that exposes Shape APIs over a MessagePort/Comlink endpoint.
// Runs in the same process for simplicity; fake-indexeddb provides IndexedDB in Node.
import 'fake-indexeddb/auto';
import type { ShapeMutationAPI, ShapeQueryAPI } from '@hierarchidb/shape-api';
import type { Endpoint as ComlinkEndpoint } from 'comlink';
import { expose, proxy } from 'comlink';
import { shapeDB } from '@hierarchidb/shape-store';
import { ShapeMutationService } from '../services/ShapeMutationService.js';
import { ShapeQueryService } from '../services/ShapeQueryService.js';

type Endpoint = MessagePort | Worker | ComlinkEndpoint;

type ShapeWorkerTestAPI = {
  getShapeQueryAPI(): ShapeQueryAPI;
  getShapeMutationAPI(): ShapeMutationAPI;
};

async function main(endpoint?: Endpoint): Promise<void> {
  const queryService = await ShapeQueryService.getSingleton(shapeDB);
  const mutationService = await ShapeMutationService.getSingleton(shapeDB);
  const api: ShapeWorkerTestAPI = {
    getShapeQueryAPI: () => proxy(queryService),
    getShapeMutationAPI: () => proxy(mutationService),
  };

  if (endpoint) {
    expose(api, endpoint);
  } else {
    expose(api);
  }
}

export { main as exposeShapeTestAPI };
