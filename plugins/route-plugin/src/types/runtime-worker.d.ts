declare module '@hierarchidb/runtime-worker' {
import type { NodeId } from '@hierarchidb/common-types';

export interface RuntimeWorkerStageClient {
  vectortile?: {
    generateTiles: (fileId: string, options: unknown) => Promise<void>;
    listTiles: (fileId: string) => Promise<Array<{ z: number; x: number; y: number; size?: number; timestamp?: number }>>;
    getTile: (fileId: string, z: number, x: number, y: number) => Promise<ArrayBuffer | Uint8Array | null>;
  };
  [key: string]: unknown;
}
export type RuntimeWorkerClientProvider =
  | RuntimeWorkerStageClient
  | null
  | undefined
  | (() => Promise<RuntimeWorkerStageClient | null> | RuntimeWorkerStageClient | null);

export function registerRuntimeWorkerClient(
  nodeType: string,
  provider: RuntimeWorkerClientProvider,
): void;

export function getRuntimeWorkerClient(
  nodeType: string,
): Promise<RuntimeWorkerStageClient | null>;

export interface SharedDownloadService {
  service: import('@hierarchidb/download').DownloadService;
  net: import('@hierarchidb/download').FetchNetworkPort;
  readAll: (fileId: string) => Promise<ArrayBuffer>;
}

export interface SharedDownloadOptions {
  dbPrefix?: string;
  perHostConcurrency?: number;
}

export function createSharedDownloadService(options?: SharedDownloadOptions): Promise<SharedDownloadService>;

export interface GroupItemBase<T = unknown> {
  id: string;
  data?: T;
  updatedAt?: number;
}

export interface PeerEntity<T = unknown> {
  nodeId: NodeId;
  updatedAt?: number;
  displayMode?: 'normal' | 'maximize' | 'full-screen';
  dialogPosition?: { x: number; y: number } | null;
  dialogSize?: { width: number; height: number } | null;
  data?: T;
}

export interface RelationBase<T = unknown> {
  srcNodeId: NodeId;
  dstNodeId: NodeId;
  type: string;
  meta?: T;
  updatedAt?: number;
}

  export interface PeerStore<T = unknown> {
    get(nodeId: NodeId): Promise<PeerEntity<T> | undefined>;
    put(entity: PeerEntity<T>): Promise<void>;
    delete(nodeId: NodeId): Promise<void>;
    bulkUpsert(entities: PeerEntity<T>[]): Promise<void>;
  }

export interface GroupStore<T = unknown> {
  list(nodeId: NodeId): Promise<T[]>;
  bulkUpsert(nodeId: NodeId, items: T[]): Promise<void>;
  bulkDelete(nodeId: NodeId, itemIds: string[]): Promise<void>;
}

export interface RelationStore<T = unknown> {
  listByNode(nodeId: NodeId): Promise<T[]>;
  bulkUpsert(relations: T[]): Promise<void>;
  bulkDelete(relations: T[]): Promise<void>;
}
}
