// Dexie-backed deletion of saved column widths. Primary key = pageNodeId.
async function deleteColumnWidthsMany(ids: string[]): Promise<void> {
  try {
    const mod = await import('@hierarchidb/ui-treeconsole-treetable');
    const fn = (mod as any).removeColumnWidthsMany as (ids: readonly string[]) => Promise<void>;
    if (typeof fn === 'function') await fn(ids);
  } catch {
    // As a safety net, also remove legacy localStorage keys if present
    for (const id of ids) {
      localStorage.removeItem(`hdb:treetable:colwidths:v1:${id}`);
      localStorage.removeItem(`TreeTableCore.columnWidths:tree:${id}`);
      localStorage.removeItem(`TreeTableCore.columnWidths:${id}`);
    }
  }
}

export function cleanupColumnWidths(_treeId: string | undefined, nodeIds: string[]): void {
  // Fire and forget
  void deleteColumnWidthsMany(nodeIds.filter(Boolean));
}

export function registerTableStateCleanupEvents(): void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent)?.detail as { treeId?: string; nodeIds?: string[] } | undefined;
    if (!detail?.nodeIds || detail.nodeIds.length === 0) return;
    cleanupColumnWidths(detail.treeId, detail.nodeIds);
  };
  window.addEventListener('hdb-remove', handler as any);
}
