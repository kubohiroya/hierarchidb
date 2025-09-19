import { Dexie, type Table } from 'dexie';

const logPropertiesDbWarning = (message: string, error: unknown): void => {
  if (typeof console === 'undefined') return;
  console.warn('[TreeTablePropertiesDB]', message, error);
};

export type TreeTableProperties = {
  pageNodeId: string; // primary key
  // property bag (extend freely without schema churn)
  columnWidths?: Record<string, number>;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  rowClickAction?: 'Select/Navigate' | 'Edit';
  viewMode?: 'list' | 'grid';
  filterBy?: string;
  selectAll?: boolean;
  updatedAt: number;
};

class UIStateDB extends Dexie {
  treetable_properties!: Table<TreeTableProperties, string>;

  constructor() {
    super('hdb_ui_state');
    // v1: historical store for column widths only
    this.version(1).stores({ treetable_colwidths: '&pageNodeId' });
    // v2: current store (also handles migrating and removing legacy table)
    this.version(2)
      .stores({ treetable_properties: '&pageNodeId' })
      .upgrade(async (tx) => {
        let legacyTable: Table<{ pageNodeId: string; widths: Record<string, number>; updatedAt?: number }, string> | null = null;
        try {
          // Access via dynamic lookup – will throw if store no longer exists (fresh installs)
          legacyTable = tx.table('treetable_colwidths');
        } catch {
          legacyTable = null;
        }
        if (!legacyTable) return;
        try {
          const legacyRows = await legacyTable.toArray();
          if (legacyRows.length > 0) {
            const target = tx.table<TreeTableProperties>('treetable_properties');
            const now = Date.now();
            for (const legacy of legacyRows) {
              await target.put({
                pageNodeId: legacy.pageNodeId,
                columnWidths: legacy.widths,
                updatedAt: typeof legacy.updatedAt === 'number' ? legacy.updatedAt : now,
              });
            }
          }
          await legacyTable.clear().catch(() => undefined);
        } catch (error) {
          logPropertiesDbWarning('Legacy treetable_colwidths migration failed', error);
        }
      });
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

export async function getSelectAll(pageNodeId: string | undefined): Promise<boolean | null> {
  const props = await getProperties(pageNodeId);
  return typeof props?.selectAll === 'boolean' ? props.selectAll : null;
}

export async function saveSelectAll(pageNodeId: string | undefined, value: boolean): Promise<void> {
  await saveProperties(pageNodeId, { selectAll: value });
}
