import { RowStoreDB, readChunkRows, TabularDatabaseManager } from '@hierarchidb/tabular-store';
import { getDBName } from '@hierarchidb/util';

type RouteTabularRowRecord = Record<string, unknown>;

type RouteRowChunkRecord = {
  id: string;
  pluginId: string;
  tableId: string;
  chunkIndex: number;
  startRowIndex: number;
  endRowIndex: number;
  binaryData: ArrayBuffer;
  createdAt: number;
  updatedAt: number;
};

const ROW_STORE_SUFFIX = 'tabular-source-rowstore-db';

const collectRowsFromChunks = (
  chunks: Array<{ binaryData: ArrayBuffer }>
): RouteTabularRowRecord[] => {
  const rows: RouteTabularRowRecord[] = [];
  for (const chunk of chunks) {
    const decoded = readChunkRows(chunk as RouteRowChunkRecord);
    for (const row of decoded) {
      if (row === null || typeof row !== 'object' || Array.isArray(row)) continue;
      rows.push(row as RouteTabularRowRecord);
    }
  }
  return rows;
};

const resolveMetadataHeaders = async (
  pluginId: string,
  tableId: string,
  dbPrefix: string
): Promise<string[]> => {
  const metadataDbName = getDBName(dbPrefix, `${pluginId}-metadata`);
  const metadataManager = new TabularDatabaseManager(metadataDbName);
  try {
    const metadata = await metadataManager.get(tableId);
    if (!metadata) {
      throw new Error('[route canonical input resolver] Tabular table not found');
    }
    const headers = Array.isArray(metadata.columns)
      ? metadata.columns
          .map((column) => column.name)
          .filter((name) => typeof name === 'string' && name.length > 0)
      : [];
    if (headers.length === 0) {
      throw new Error('[route canonical input resolver] Tabular table has no columns');
    }
    return headers;
  } finally {
    await metadataManager.close();
  }
};

export type RouteTabularTableRows = {
  headers: string[];
  rows: RouteTabularRowRecord[];
};

export const loadRouteTabularTableRows = async (
  pluginId: string,
  tableId: string,
  dbPrefix: string
): Promise<RouteTabularTableRows> => {
  const headers = await resolveMetadataHeaders(pluginId, tableId, dbPrefix);
  const rowStoreDbName = getDBName(dbPrefix, ROW_STORE_SUFFIX);
  const db = new RowStoreDB(rowStoreDbName);
  try {
    await db.open();
    const chunks = await db.rowChunks
      .where('[pluginId+tableId]')
      .equals([pluginId, tableId])
      .sortBy('chunkIndex');
    const rows = collectRowsFromChunks(chunks);
    if (rows.length === 0) {
      throw new Error('[route canonical input resolver] Tabular table has no rows');
    }
    return { headers, rows };
  } finally {
    db.close();
  }
};
