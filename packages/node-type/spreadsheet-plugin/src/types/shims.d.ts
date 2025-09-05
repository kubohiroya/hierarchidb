declare module '@hierarchidb/tabular' {
  export type FileLike = any;
  export type TabularChunk<T=any> = any;
  export type TabularSchema = any;
  export type TabularIngestSummary<T=any> = any;
  export type TabularIngestResult<T=any> = any;
  export type TabularIngestSession<T=any> = any;
  export class TabularService { constructor(...args: any[]); ingest(file: any, store: any, opts?: any): Promise<any>; }
  export class TabularStorePort<T=any> { constructor(...args: any[]); }
  const _default: any;
  export default _default;
}

declare module '@hierarchidb/auth-recovery' {
  export class AuthRecoveryService { constructor(...args: any[]); static getSingleton: (...args: any[]) => any }
  const _default: any;
  export default _default;
}

declare module '@hierarchidb/runtime-worker/entity/store-registry' {
  export const StoreRegistry: any;
  export default StoreRegistry;
}

declare module '@hierarchidb/runtime-worker/entity/store' {
  export const EntityStore: any;
}
