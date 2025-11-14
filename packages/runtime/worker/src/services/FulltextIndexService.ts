import type { TreeChangeEvent } from '@hierarchidb/common-types';
import type { NodeId, TreeId, TreeNode } from '@hierarchidb/common-types';
import { SingletonMixin } from '@hierarchidb/util';
import type { Table } from 'dexie';
import type { Subscription } from 'rxjs';
import type { CoreDB } from './CoreDB.js';
import type { FulltextIndexRecord, FulltextNodeRecord } from './fulltext-types.js';

const DEFAULT_LOCALE = 'en';

interface FulltextSearchParams {
  rootNodeId: NodeId;
  query: string;
  maxResults?: number;
  locale?: string;
}

export class FulltextIndexService {
  static async getSingleton(coreDB: CoreDB): Promise<FulltextIndexService> {
    return SingletonMixin.getSingleton(FulltextIndexService.name, async () => {
      return new FulltextIndexService(coreDB);
    });
  }

  private readonly fulltextNodes: Table<FulltextNodeRecord, [TreeId, NodeId]>;
  private readonly fulltextIndexes: Table<FulltextIndexRecord, [TreeId, string]>;
  private readonly subscription: Subscription;

  private constructor(private readonly coreDB: CoreDB) {
    this.fulltextNodes = coreDB.fulltextNodes;
    this.fulltextIndexes = coreDB.fulltextIndexes;
    this.subscription = this.coreDB.changeSubject.subscribe({
      next: (event) => {
        void this.handleChangeEvent(event).catch((error) => {
          console.warn('[FulltextIndexService] change handling failed', error);
        });
      },
    });
  }

  dispose(): void {
    this.subscription.unsubscribe();
  }

  async search(params: FulltextSearchParams): Promise<TreeNode[]> {
    const { rootNodeId, query } = params;
    const locale = (params.locale || DEFAULT_LOCALE).toLowerCase();
    const treeId = this.extractTreeId(rootNodeId);
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    await this.recordLocaleUsage(treeId, locale);
    await this.ensureIndexReady(treeId, locale);

    const allowedIds = await this.collectAllowedNodes(rootNodeId);
    const normalizedQuery = this.normalize(trimmed);

    const rows = await this.fulltextNodes.where('treeId').equals(treeId).toArray();
    const matches: TreeNode[] = [];
    for (const row of rows) {
      if (!allowedIds.has(row.nodeId)) continue;
      const haystack = this.buildSearchText(row);
      if (haystack.includes(normalizedQuery)) {
        const node = await this.coreDB.getNode(row.nodeId);
        if (node) {
          matches.push(node);
        }
      }
      if (params.maxResults && matches.length >= params.maxResults) {
        break;
      }
    }

    return matches;
  }

  async recordLocaleUsage(treeId: TreeId, locale: string): Promise<void> {
    const existing = await this.fulltextIndexes.get([treeId, locale]);
    if (!existing) {
      await this.fulltextIndexes.put({
        treeId,
        locale,
        updatedAt: 0,
        dirty: true,
      });
    }
  }

  private async ensureIndexReady(treeId: TreeId, locale: string): Promise<void> {
    const state = await this.fulltextIndexes.get([treeId, locale]);
    if (!state || state.dirty) {
      await this.buildIndex(treeId, locale);
    }
  }

  private async buildIndex(treeId: TreeId, locale: string): Promise<void> {
    await this.seedFulltextNodes(treeId);
    await this.fulltextIndexes.put({
      treeId,
      locale,
      updatedAt: Date.now(),
      dirty: false,
    });
  }

  private async seedFulltextNodes(treeId: TreeId): Promise<void> {
    const existingCount = await this.fulltextNodes.where('treeId').equals(treeId).count();
    if (existingCount > 0) {
      return;
    }

    const prefix = `${treeId}:`;
    const nodes = await this.coreDB.nodes.where('id').startsWith(prefix).toArray();
    const rows: FulltextNodeRecord[] = nodes.map((node) => ({
      treeId,
      nodeId: node.id,
      parentId: node.parentId,
      name: node.name ?? '',
      description: node.description ?? '',
      updatedAt: node.updatedAt ?? Date.now(),
    }));
    if (rows.length > 0) {
      await this.fulltextNodes.bulkPut(rows);
    }
  }

  private async collectAllowedNodes(rootNodeId: NodeId): Promise<Set<NodeId>> {
    const allowed = new Set<NodeId>([rootNodeId]);
    const descendants = await this.coreDB.listDescendants(rootNodeId);
    for (const node of descendants) {
      allowed.add(node.id);
    }
    return allowed;
  }

  private normalize(value: string): string {
    return value.toLocaleLowerCase();
  }

  private buildSearchText(row: FulltextNodeRecord): string {
    return `${row.name}\n${row.description ?? ''}`.toLocaleLowerCase();
  }

  private extractTreeId(nodeId: NodeId): TreeId {
    const separator = nodeId.indexOf(':');
    if (separator === -1) {
      return nodeId as unknown as TreeId;
    }
    return nodeId.slice(0, separator) as unknown as TreeId;
  }

  private async handleChangeEvent(event: TreeChangeEvent): Promise<void> {
    switch (event.type) {
      case 'node-created':
      case 'node-updated':
      case 'node-moved':
        if (event.node) {
          await this.upsertNodeRecord(event.node);
        }
        await this.markTreeDirty(event.nodeId);
        break;
      case 'node-deleted':
        await this.removeNodeRecord(event.nodeId);
        await this.markTreeDirty(event.nodeId);
        break;
      default:
        await this.markTreeDirty(event.nodeId);
        break;
    }
  }

  private async upsertNodeRecord(node: TreeNode): Promise<void> {
    const treeId = this.extractTreeId(node.id);
    await this.fulltextNodes.put({
      treeId,
      nodeId: node.id,
      parentId: node.parentId,
      name: node.name ?? '',
      description: node.description ?? '',
      updatedAt: Date.now(),
    });
  }

  private async removeNodeRecord(nodeId: NodeId): Promise<void> {
    const treeId = this.extractTreeId(nodeId);
    await this.fulltextNodes.delete([treeId, nodeId]);
  }

  private async markTreeDirty(nodeId: NodeId): Promise<void> {
    const treeId = this.extractTreeId(nodeId);
    const records = await this.fulltextIndexes.where('treeId').equals(treeId).toArray();
    if (records.length === 0) {
      await this.fulltextIndexes.put({
        treeId,
        locale: DEFAULT_LOCALE,
        updatedAt: 0,
        dirty: true,
      });
      return;
    }
    const updates = records.map((record) => ({ ...record, dirty: true }));
    await this.fulltextIndexes.bulkPut(updates);
  }
}
