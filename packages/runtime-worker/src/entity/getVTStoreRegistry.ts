import { VTStoreRegistry } from './VTStoreRegistry.js';

const vtStoreRegistry = new VTStoreRegistry();

export function getVTStoreRegistry(): VTStoreRegistry {
  return vtStoreRegistry;
}
