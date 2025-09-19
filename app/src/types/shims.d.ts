// Minimal type shims for packages that don't have proper exports
// Most types are now imported from actual packages


// legacy virtual:plugin-map removed; use virtual:plugin-registry-*

//  Removed: UI and worker package shims replaced by real package types

// Virtual modules now have generated d.ts under app/.generated/types
declare module 'virtual:plugin-definitions' {
  const defs: any[];
  export default defs;
}

declare module 'virtual:mui-icon-map' {
  const iconMap: Record<string, any>;
  export default iconMap;
}

declare module 'virtual:plugin-registry-services' {
  const services: any;
  export default services;
}

declare module 'virtual:plugin-registry-worker' {
  const workerEntrypoints: any;
  export default workerEntrypoints;
}

// FEATURE FLAGS (ambient)
declare global {
  interface FeatureFlags {
    SUBSCRIPTION_BATCH_MS?: number | string;
    [key: string]: unknown;
  }
  // eslint-disable-next-line no-var
  var FEATURE_FLAGS: FeatureFlags | undefined;
}

// Exports subpath shim for TS4.x (remove after TS5 migration or when nodenext is adopted)
declare module '@hierarchidb/resolver-plugin/database' {
  const mod: any;
  export = mod;
}
