// Worker entry for shape-plugin providing standardized factory exports
export async function createEntityHandler() {
  const { ShapeEntityHandler } = await import('../handlers/ShapeEntityHandler.js');
  return new ShapeEntityHandler();
}

export const lifecycle = {} as const;

