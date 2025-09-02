declare module '@hierarchidb/download' {
  export class FetchNetworkPort { constructor(opts?: any); }
  export class DexieChunkStoragePort { constructor(name?: string); readAll?(fileId: string): Promise<ArrayBuffer>; }
  export class DownloadService { constructor(net: any, store: any, integrity?: any); download(url: string, fileId: string, opts?: any): Promise<{ fileId: string; sizeBytes?: number; hash?: string }>; }
}
