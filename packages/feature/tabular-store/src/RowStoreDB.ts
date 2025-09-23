import { Dexie, type Table } from 'dexie';
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

  constructor(name: string = getDBName('tabular-rowstore-db')) {
    super(name);
    this.version(1).stores({
      rowChunks: '&id, [pluginId+tableId], tableId, pluginId, chunkIndex, createdAt',
    });
    // v2: add indexes table and additional compound indexes for faster row resolution
    this.version(2).stores({
      // Query by plugin+table+startRowIndex to locate chunks for specific rowIds quickly
      rowChunks: '&id, [pluginId+tableId], [pluginId+tableId+startRowIndex], [pluginId+tableId+endRowIndex], tableId, pluginId, chunkIndex, createdAt',
      // Inverted index: one entry per (plugin, table, column, value)
      rowIndexes: '&id, [pluginId+tableId+column], [pluginId+tableId+column+value]',
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
