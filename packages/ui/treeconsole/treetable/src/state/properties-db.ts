import { Dexie, type Table } from 'dexie';
import { getDBName } from '@hierarchidb/util';

type DialogDisplayMode = 'normal' | 'maximize' | 'full-screen';

export type TreeTableProps = {
  pageNodeId: string; // primary key
  // property bag (extend freely without schema churn)
  columnWidths?: Record<string, number>;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  rowClickAction?: 'Select/Navigate' | 'Edit';
  viewMode?: 'list' | 'grid';
  filterBy?: string;
  selectAll?: boolean;
  dialogPosition?: { x: number; y: number };
  dialogSize?: { width: number; height: number };
  dialogDisplayMode?: DialogDisplayMode;
  updatedAt: number;
};

export type TreeTableExpandedRow = {
  pageNodeId: string;
  nodeId: string;
  updatedAt: number;
};

class UIStateDB extends Dexie {
  treetableProps!: Table<TreeTableProps, string>;
  treetableExpanded!: Table<TreeTableExpandedRow, [string, string]>;

  constructor() {
    super(getDBName('ui-state'));
    // v4: add treetableExpanded alongside treetableProps
    this.version(4).stores({
      treetableProps: '&pageNodeId',
      treetableExpanded: '&[pageNodeId+nodeId], pageNodeId, nodeId',
    });
  }
}

let _db: UIStateDB | null = null;
function db(): UIStateDB { if (!_db) _db = new UIStateDB(); return _db; }

export async function getProperties(pageNodeId: string | undefined): Promise<TreeTableProps | null> {
  if (!pageNodeId) return null;
  const d = db();
  // Try new store first
  const row = await d.treetableProps.get(pageNodeId);
  if (row) {
    const rawMode = row.dialogDisplayMode as string | undefined;
    if (rawMode === 'standard' || rawMode === 'maximized' || rawMode === 'fullscreen') {
      const migrated: TreeTableProps = {
        ...row,
        dialogDisplayMode:
          rawMode === 'standard' ? 'normal' : rawMode === 'maximized' ? 'maximize' : 'full-screen',
        updatedAt: Date.now(),
      };
      await d.treetableProps.put(migrated);
      return migrated;
    }
    return row;
  }
  return null;
}

export async function saveProperties(pageNodeId: string | undefined, patch: Partial<TreeTableProps>): Promise<void> {
  if (!pageNodeId) return;
  const d = db();
  const prev = (await d.treetableProps.get(pageNodeId)) || { pageNodeId, updatedAt: 0 } as TreeTableProps;
  const next: TreeTableProps = { ...prev, ...patch, pageNodeId, updatedAt: Date.now() };
  await d.treetableProps.put(next);
}

export async function removeProperties(pageNodeId: string | undefined): Promise<void> {
  if (!pageNodeId) return;
  await db().treetableProps.delete(pageNodeId);
}

export async function removePropertiesMany(pageNodeIds: readonly string[]): Promise<void> {
  if (!pageNodeIds?.length) return;
  await db().treetableProps.bulkDelete(pageNodeIds.filter(Boolean) as string[]);
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
