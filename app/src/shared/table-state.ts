export function makeColumnWidthsKey(treeId: string | undefined, rootNodeId: string | undefined): string {
  const key = `hdb:treetable:colwidths:v1:${treeId || 'unknown'}:${rootNodeId || 'root'}`;
  return key;
}

export function cleanupColumnWidths(treeId: string | undefined, nodeIds: string[]): void {
  try {
    const keys = new Set<string>();
    for (const id of nodeIds) {
      // current
      keys.add(makeColumnWidthsKey(treeId, id));
      // legacy fallbacks
      keys.add(`TreeTableCore.columnWidths:tree:${id}`);
      keys.add(`TreeTableCore.columnWidths:${id}`);
    }
    keys.forEach((k) => { try { localStorage.removeItem(k); } catch {} });
  } catch {}
}

export function registerTableStateCleanupEvents(): void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent)?.detail as { treeId?: string; nodeIds?: string[] } | undefined;
    if (!detail?.nodeIds || detail.nodeIds.length === 0) return;
    cleanupColumnWidths(detail.treeId, detail.nodeIds);
  };
  try { window.addEventListener('hdb-remove', handler as any); } catch {}
}

