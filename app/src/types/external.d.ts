declare module '@hierarchidb/route-plugin/worker' {
  export function createEntityHandler(): Promise<any>;
  export function createBatchManager(): Promise<any>;
  export const lifecycle: any;
}

// Minimal ambient type for geojson-vt so app typecheck passes when worker imports it.
// Prefer installing official types: `pnpm add -D @types/geojson-vt` at the workspace root.
