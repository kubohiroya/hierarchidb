/**
 * Worker Package Test Setup
 * Uses base setup with worker-specific configurations
 */

// Import base setup (includes all _obsolate_common mocks)
// Minimal worker-specific test setup for isolated unit tests.
// Intentionally avoids importing monorepo-wide setup to prevent tsconfig resolution issues.

type EntitiesDbTable = {
  delete(id: string): Promise<void> | void;
};

type EntitiesDbAdapter = {
  open(): Promise<void> | void;
  table(name: string): EntitiesDbTable | undefined;
};

type EntitiesOverrideFactory =
  | EntitiesDbAdapter
  | (() => EntitiesDbAdapter | Promise<EntitiesDbAdapter | undefined> | undefined)
  | (() => Promise<EntitiesDbAdapter | undefined>);

type TestGlobal = typeof globalThis & {
  __HDB_PLUGIN_ENTITY_OVERRIDES__?: Record<string, EntitiesOverrideFactory>;
};

const globalWithOverrides = globalThis as TestGlobal;

// Provide lightweight EntitiesDB overrides so peer-entity cleanup code paths
// do not attempt to import plugin-specific Dexie implementations during unit tests.
const createMockEntitiesDB = (): EntitiesDbAdapter => {
  const rows = new Map<string, unknown>();
  return {
    async open() {
      /* no-op */
    },
    table() {
      return {
        async delete(id: string) {
          rows.delete(id);
        },
      };
    },
  };
};

const overrides = (globalWithOverrides.__HDB_PLUGIN_ENTITY_OVERRIDES__ ??= {});
for (const type of ['folder', 'route', 'resolver', 'shape', 'location', 'spreadsheet', 'styler', 'basemap', 'linker', 'timeline']) {
  if (!overrides[type]) {
    overrides[type] = async () => createMockEntitiesDB();
  }
}
