/**
 * Worker Package Test Setup
 * Uses base setup with worker-specific configurations
 */

// Import base setup (includes all common mocks)
// Minimal worker-specific test setup for isolated unit tests.
// Intentionally avoids importing monorepo-wide setup to prevent tsconfig resolution issues.

// Bridge legacy tests that set process.env flags to FEATURE_FLAGS on globalThis.
// This keeps production code free of `process` while preserving existing tests.
const g: any = (globalThis as any);
g.FEATURE_FLAGS = g.FEATURE_FLAGS || {};
const env: any = (typeof process !== 'undefined' ? (process as any).env : undefined) || {};
const keys = [
  'WORKER_PROGRESS_COMMON_TYPES',
];
for (const k of keys) if (env[k] != null) g.FEATURE_FLAGS[k] = env[k];

// Provide lightweight EntitiesDB overrides so peer-entity cleanup code paths
// do not attempt to import plugin-specific Dexie implementations during unit tests.
const createMockEntitiesDB = () => {
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

const overrides = (g.__HDB_PLUGIN_ENTITY_OVERRIDES__ = g.__HDB_PLUGIN_ENTITY_OVERRIDES__ || {});
for (const type of ['folder', 'route', 'resolver', 'shape', 'location', 'spreadsheet', 'styler', 'basemap']) {
  if (!overrides[type]) {
    overrides[type] = async () => createMockEntitiesDB();
  }
}
