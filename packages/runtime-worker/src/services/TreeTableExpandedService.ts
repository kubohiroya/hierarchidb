import type { TreeQueryAPI } from '@hierarchidb/tree-api';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeTableExpandedRow, UIStateDB } from './UIStateDB.js';

export class TreeTableExpandedService {
  private static readonly DELETE_CHUNK_SIZE = 200;

  constructor(
    private readonly uiStateDB: UIStateDB,
    private readonly queryService: TreeQueryAPI
  ) {}

  async getExpandedNodes(pageNodeId: NodeId | undefined | null): Promise<NodeId[]> {
    if (!pageNodeId) return [];
    const rows = await this.uiStateDB.treetableExpanded
      .where('pageNodeId')
      .equals(String(pageNodeId))
      .sortBy('updatedAt');
    return rows.map((row) => row.nodeId as NodeId);
  }

  async openNodes(
    pageNodeId: NodeId | undefined | null,
    nodeIds: ReadonlyArray<NodeId | string>
  ): Promise<void> {
    if (!pageNodeId || !nodeIds?.length) return;
    const normalizedIds = nodeIds.map((id) => String(id)).filter(Boolean);
    if (!normalizedIds.length) return;
    const now = Date.now();
    const rows: TreeTableExpandedRow[] = normalizedIds.map((nodeId) => ({
      pageNodeId: String(pageNodeId),
      nodeId,
      updatedAt: now,
    }));
    await this.uiStateDB.treetableExpanded.bulkPut(rows);
  }

  async closeNodes(
    pageNodeId: NodeId | undefined | null,
    nodeIds: ReadonlyArray<NodeId | string>
  ): Promise<void> {
    if (!pageNodeId || !nodeIds?.length) return;
    const keys = nodeIds
      .map((id) => String(id))
      .filter(Boolean)
      .map((nodeId) => [String(pageNodeId), nodeId] as [string, string]);
    if (!keys.length) return;
    await this.uiStateDB.treetableExpanded.bulkDelete(keys);
  }

  async clearExpandedForPage(pageNodeId: NodeId | undefined | null): Promise<number> {
    if (!pageNodeId) return 0;
    return this.uiStateDB.treetableExpanded.where('pageNodeId').equals(String(pageNodeId)).delete();
  }

  async clearExpandedForSubtree(nodeIds: ReadonlyArray<NodeId | string>): Promise<void> {
    const roots = nodeIds.map((id) => String(id)).filter(Boolean);
    if (!roots.length) return;

    const idsToClear = new Set<string>(roots);
    for (const rootId of roots) {
      try {
        const descendants = await this.queryService.listDescendants(rootId as NodeId);
        for (const node of descendants) {
          if (node?.id) {
            idsToClear.add(String(node.id));
          }
        }
      } catch (error) {
        console.warn('[TreeTableExpandedService] listDescendants failed for', rootId, error);
      }
    }

    await this.deleteByNodeIds(Array.from(idsToClear));
  }

  private async deleteByNodeIds(nodeIds: string[]): Promise<void> {
    if (!nodeIds.length) return;
    const table = this.uiStateDB.treetableExpanded;
    const chunkSize = TreeTableExpandedService.DELETE_CHUNK_SIZE;
    await this.uiStateDB.transaction('rw', table, async () => {
      for (let i = 0; i < nodeIds.length; i += chunkSize) {
        const chunk = nodeIds.slice(i, i + chunkSize);
        await table.where('nodeId').anyOf(chunk).delete();
      }
    });
  }
}
