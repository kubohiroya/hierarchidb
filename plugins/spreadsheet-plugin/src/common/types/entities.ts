/**
 * Spreadsheet plugin worker entity data structures used by Dexie stores.
 */

export interface SpreadsheetGroupItemData {
  schemaVersion: 1;
  label?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface SpreadsheetRelationMeta {
  schemaVersion: 1;
  relationKind?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}
