import { Dexie, type Table } from 'dexie';

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

export interface RowIndexEntry {
  id: string; // `${pluginId}:${tableId}:${column}:${value}` (value truncated/hash-safe)
  pluginId: string;
  tableId: string;
  column: string;
  value: string; // normalized string value
  rowIds: number[]; // list of rowIds where column==value (bucketed append)
  updatedAt: number;
}

export class RowStoreDB extends Dexie {
  rowChunks!: Table<RowChunk, string>;
  rowIndexes!: Table<RowIndexEntry, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      rowChunks: '&id, [pluginId+tableId], [pluginId+tableId+startRowIndex], [pluginId+tableId+endRowIndex], tableId, pluginId, chunkIndex, createdAt',
      rowIndexes: '&id, [pluginId+tableId+column], [pluginId+tableId+column+value]',
    });
  }
}

let singleton: RowStoreDB | null = null;

export function getRowStoreDB(databaseName: string): RowStoreDB {
  if (typeof databaseName !== 'string' || databaseName.length === 0) {
    throw new Error('row-store-database-name-required');
  }
  if (!singleton) singleton = new RowStoreDB(databaseName);
  if (singleton.name !== databaseName) {
    throw new Error('row-store-database-name-mismatch');
  }
  return singleton;
}

export async function closeRowStoreDB(): Promise<void> {
  if (singleton) {
    await singleton.close();
    singleton = null;
  }
}

const decoder = new TextDecoder();

export function readChunkRows(chunk: RowChunk): unknown[] {
  try {
    const json = decoder.decode(new Uint8Array(chunk.binaryData));
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
