import Dexie, { type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';

export interface RowChunk {
  id: string;
  pluginId: string; // e.g., 'location' | 'shape' | 'route'
  tableId: string;
  chunkIndex: number;
  startRowIndex: number;
  endRowIndex: number;
  binaryData: ArrayBuffer;
  createdAt: number;
  updatedAt: number;
}

export class RowStoreDB extends Dexie {
  rowChunks!: Table<RowChunk>;
  constructor(name: string = getDBName('tabular-rowstore-db')) {
    super(name);
    this.version(1).stores({
      rowChunks: '&id, [pluginId+tableId], tableId, pluginId, chunkIndex, createdAt'
    });
  }
}

let singleton: RowStoreDB | null = null;
export function getRowStoreDB(): RowStoreDB {
  if (!singleton) singleton = new RowStoreDB();
  return singleton;
}

export async function closeRowStoreDB(): Promise<void> {
  if (singleton) {
    await singleton.close();
    singleton = null;
  }
}

