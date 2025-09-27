// Worker entry for shape-plugin providing standardized factory exports
export async function createEntityHandler() {
  const { ShapeEntityHandler } = await import('../handlers/ShapeEntityHandler.js');
  return new ShapeEntityHandler();
}

export async function createBatchManager() {
  const { createShapeBatchManager } = await import('../services/batch/UnifiedShapeBatchManager.js');
  return createShapeBatchManager();
}

export const lifecycle = {} as const;
