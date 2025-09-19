type PrewarmDatabase = {
  open: () => Promise<unknown>;
};

const isBrowserEnvironment = (): boolean => typeof window !== 'undefined';

const logDatabaseWarning = (label: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn(`[services/databases] Failed to load ${label} database`, error);
};

async function loadDatabase<T extends PrewarmDatabase>(
  label: string,
  loader: () => Promise<T>,
): Promise<T | undefined> {
  if (!isBrowserEnvironment()) return undefined;
  try {
    return await loader();
  } catch (error) {
    logDatabaseWarning(label, error);
    return undefined;
  }
}

export async function getBaseMapDatabase(): Promise<PrewarmDatabase | undefined> {
  return await loadDatabase('basemap', async () => {
    const mod = await import('@hierarchidb/node-type-basemap-plugin/database');
    const { BaseMapDatabase } = mod as typeof import('@hierarchidb/node-type-basemap-plugin/database');
    return new BaseMapDatabase() as unknown as PrewarmDatabase;
  });
}

export async function getResolverDB(): Promise<PrewarmDatabase | undefined> {
  return await loadDatabase('resolver', async () => {
    const mod = await import('@hierarchidb/node-type-resolver-plugin/database');
    const { resolverDB } = mod as typeof import('@hierarchidb/node-type-resolver-plugin/database');
    return resolverDB as unknown as PrewarmDatabase;
  });
}

export async function getSpreadsheetDatabase(): Promise<PrewarmDatabase | undefined> {
  return await loadDatabase('spreadsheet', async () => {
    const mod = await import('@hierarchidb/node-type-spreadsheet-plugin/database');
    const { SpreadsheetDatabase } = mod as typeof import('@hierarchidb/node-type-spreadsheet-plugin/database');
    return new SpreadsheetDatabase() as unknown as PrewarmDatabase;
  });
}

export async function getRouteDatabase(): Promise<PrewarmDatabase | undefined> {
  return await loadDatabase('route', async () => {
    const mod = await import('@hierarchidb/node-type-route-plugin/database');
    const { RouteDatabase } = mod as typeof import('@hierarchidb/node-type-route-plugin/database');
    return new RouteDatabase() as unknown as PrewarmDatabase;
  });
}

export async function getShapeDatabase(): Promise<PrewarmDatabase | undefined> {
  return await loadDatabase('shape', async () => {
    const mod = await import('@hierarchidb/node-type-shape-plugin/services');
    const { ShapeDB } = mod as typeof import('@hierarchidb/node-type-shape-plugin/services');
    return new ShapeDB() as unknown as PrewarmDatabase;
  });
}

export async function getLocationEphemeralDB(): Promise<PrewarmDatabase | undefined> {
  return await loadDatabase('location', async () => {
    const mod = await import('@hierarchidb/node-type-location-plugin/services');
    const { getEphemeralLocationDB } = mod as typeof import('@hierarchidb/node-type-location-plugin/services');
    return getEphemeralLocationDB() as unknown as PrewarmDatabase;
  });
}
