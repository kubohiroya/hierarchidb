export type DatabaseStoreLoaderEntry = {
  moduleSpecifier: string;
  loader: () => Promise<unknown>;
  prewarm: Array<{
    specifier: string;
    exportName: string;
    load: () => Promise<unknown>;
  }>;
};

export const databaseStoreLoaders: Record<string, DatabaseStoreLoaderEntry> = {
  location: {
    moduleSpecifier: '@hierarchidb/location-store',
    async loader() {
      return await import('@hierarchidb/location-store');
    },
    prewarm: [
      {
        specifier: '@hierarchidb/location-store',
        exportName: 'getLocationDB',
        async load() {
          return await import('@hierarchidb/location-store');
        },
      },
    ],
  },
  route: {
    moduleSpecifier: '@hierarchidb/route-store',
    async loader() {
      return await import('@hierarchidb/route-store');
    },
    prewarm: [
      {
        specifier: '@hierarchidb/route-store',
        exportName: 'RouteDB',
        async load() {
          return await import('@hierarchidb/route-store');
        },
      },
    ],
  },
  shape: {
    moduleSpecifier: '@hierarchidb/shape-store',
    async loader() {
      return await import('@hierarchidb/shape-store');
    },
    prewarm: [
      {
        specifier: '@hierarchidb/shape-store',
        exportName: 'shapeDB',
        async load() {
          return await import('@hierarchidb/shape-store');
        },
      },
    ],
  },
};

export const APP_DATABASE_NODE_TYPES = Object.keys(databaseStoreLoaders);
export const APP_DATABASE_NODE_TYPES_SET = new Set<string>(APP_DATABASE_NODE_TYPES);
