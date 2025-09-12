declare module '@hierarchidb/route-plugin/worker' {
  export function createEntityHandler(): Promise<any>;
  export function createBatchManager(): Promise<any>;
  export const lifecycle: any;
}

