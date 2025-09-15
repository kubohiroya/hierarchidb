import Dexie, { type Table } from 'dexie';

export type TreeTableProperties = {
  pageNodeId: string; // primary key
  // property bag (extend freely without schema churn)
  columnWidths?: Record<string, number>;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  rowClickAction?: 'Select/Navigate' | 'Edit';
  viewMode?: 'list' | 'grid';
  filterBy?: string;
  updatedAt: number;
};

class UIStateDB extends Dexie {
  treetable_properties!: Table<TreeTableProperties, string>;
  treetable_colwidths!: Table<{ pageNodeId: string; widths: Record<string, number>; updatedAt: number }, string>;

  constructor() {
    super('hdb_ui_state');
    // v1: introduced treetable_colwidths (legacy, used only for migration)
    // v2: treetable_properties (current). Dexie will auto-migrate store additions.
    this.version(1).stores({ treetable_colwidths: '&pageNodeId' });
    this.version(2).stores({ treetable_properties: '&pageNodeId' });
  }
}

let _db: UIStateDB | null = null;
function db(): UIStateDB { if (!_db) _db = new UIStateDB(); return _db; }

export async function getProperties(pageNodeId: string | undefined): Promise<TreeTableProperties | null> {
  if (!pageNodeId) return null;
  const d = db();
  // Try new store first
  let row = await d.treetable_properties.get(pageNodeId);
  if (row) return row;
  // Migrate from legacy colwidths store if present
  const legacy = await d.treetable_colwidths.get(pageNodeId);
  if (legacy) {
    const migrated: TreeTableProperties = { pageNodeId, columnWidths: legacy.widths, updatedAt: legacy.updatedAt };
    await d.treetable_properties.put(migrated);
    try { await d.treetable_colwidths.delete(pageNodeId); } catch {}
    return migrated;
  }
  return null;
}

export async function saveProperties(pageNodeId: string | undefined, patch: Partial<TreeTableProperties>): Promise<void> {
  if (!pageNodeId) return;
  const d = db();
  const prev = (await d.treetable_properties.get(pageNodeId)) || { pageNodeId, updatedAt: 0 } as TreeTableProperties;
  const next: TreeTableProperties = { ...prev, ...patch, pageNodeId, updatedAt: Date.now() };
  await d.treetable_properties.put(next);
}

export async function removeProperties(pageNodeId: string | undefined): Promise<void> {
  if (!pageNodeId) return;
  await db().treetable_properties.delete(pageNodeId);
}

export async function removePropertiesMany(pageNodeIds: readonly string[]): Promise<void> {
  if (!pageNodeIds?.length) return;
  await db().treetable_properties.bulkDelete(pageNodeIds.filter(Boolean) as string[]);
}

// Convenience adapters for column widths
export async function getColumnWidths(pageNodeId: string | undefined): Promise<Record<string, number> | null> {
  const props = await getProperties(pageNodeId);
  return props?.columnWidths ?? null;
}

export async function saveColumnWidths(pageNodeId: string | undefined, widths: Record<string, number>): Promise<void> {
  await saveProperties(pageNodeId, { columnWidths: widths });
}

export async function removeColumnWidths(pageNodeId: string | undefined): Promise<void> {
  // Removing whole property row is fine; if you prefer, patch undefined columnWidths instead.
  await removeProperties(pageNodeId);
}

export async function removeColumnWidthsMany(pageNodeIds: readonly string[]): Promise<void> {
  await removePropertiesMany(pageNodeIds);
}

