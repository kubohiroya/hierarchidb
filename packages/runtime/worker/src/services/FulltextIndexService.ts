import type { TreeChangeEvent, TreeNode } from '@hierarchidb/common-types';
import type { NodeId, TreeId } from '@hierarchidb/common-types';
import type { Table } from 'dexie';
import lunr from 'lunr';
import { SingletonMixin } from '@hierarchidb/util';
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

  static async createForTesting(coreDB: CoreDB): Promise<FulltextIndexService> {
    return new FulltextIndexService(coreDB);
  }

  private readonly fulltextNodes: Table<FulltextNodeRecord, [TreeId, NodeId]>;
  private readonly fulltextIndexes: Table<FulltextIndexRecord, [TreeId, string]>;
  private readonly subscription: Subscription;
  private readonly rebuildQueue = new Map<string, Promise<void>>();

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

    void this.bootstrapExistingIndexes();
  }

  dispose(): void {
    this.subscription.unsubscribe();
    this.rebuildQueue.clear();
  }

  async search(params: FulltextSearchParams): Promise<TreeNode[]> {
    const locale = (params.locale || DEFAULT_LOCALE).toLowerCase();
    const treeId = this.extractTreeId(params.rootNodeId);
    const trimmed = params.query.trim();
    if (!trimmed) {
      return [];
    }

    await this.recordLocaleUsage(treeId, locale);
    await this.ensureIndexReady(treeId, locale);

    const state = await this.fulltextIndexes.get([treeId, locale]);
    if (!state?.serializedIndex) {
      return [];
    }

    const allowedIds = await this.collectAllowedNodes(params.rootNodeId);
    const index = lunr.Index.load(JSON.parse(state.serializedIndex));
    const results = index.search(trimmed);

    const matches: TreeNode[] = [];
    for (const result of results) {
      const nodeId = result.ref as NodeId;
      if (!allowedIds.has(nodeId)) continue;
      const node = await this.coreDB.getNode(nodeId);
      if (node) {
        matches.push(node);
      }
      if (params.maxResults && matches.length >= params.maxResults) {
        break;
      }
    }

    return matches;
  }

  async recordLocaleUsage(treeId: TreeId, rawLocale: string): Promise<void> {
    const locale = rawLocale.toLowerCase();
    const existing = await this.fulltextIndexes.get([treeId, locale]);
    if (!existing) {
      await this.fulltextIndexes.put({
        treeId,
        locale,
        updatedAt: 0,
        dirty: true,
      });
    }
    void this.scheduleRebuild(treeId, locale);
  }

  private async bootstrapExistingIndexes(): Promise<void> {
    const existing = await this.fulltextIndexes.toArray();
    await Promise.all(
      existing
        .filter((record) => record.dirty || !record.serializedIndex)
        .map((record) => this.scheduleRebuild(record.treeId, record.locale))
    );
  }

  private async ensureIndexReady(treeId: TreeId, locale: string): Promise<void> {
    const state = await this.fulltextIndexes.get([treeId, locale]);
    if (!state || state.dirty || !state.serializedIndex) {
      await this.scheduleRebuild(treeId, locale);
    }
  }

  private buildRebuildKey(treeId: TreeId, locale: string): string {
    return `${treeId}:${locale}`;
  }

  private scheduleRebuild(treeId: TreeId, locale: string): Promise<void> {
    const key = this.buildRebuildKey(treeId, locale);
    const existing = this.rebuildQueue.get(key);
    if (existing) {
      return existing;
    }

    const task = (async () => {
      try {
        await this.buildIndex(treeId, locale);
      } catch (error) {
        console.warn('[FulltextIndexService] rebuild failed', { treeId, locale }, error);
        await this.fulltextIndexes.put({
          treeId,
          locale,
          updatedAt: Date.now(),
          dirty: true,
        });
      } finally {
        this.rebuildQueue.delete(key);
      }
    })();

    this.rebuildQueue.set(key, task);
    return task;
  }

  private async buildIndex(treeId: TreeId, locale: string): Promise<void> {
    await this.seedFulltextNodes(treeId);
    const docs = await this.fulltextNodes.where('treeId').equals(treeId).toArray();

    const builder = new lunr.Builder();
    builder.ref('nodeId');
    builder.field('name');
    builder.field('description');
    builder.metadataWhitelist = ['position'];

    this.configureLocalePipeline(builder, locale);

    for (const doc of docs) {
      builder.add({
        nodeId: doc.nodeId,
        name: doc.name ?? '',
        description: doc.description ?? '',
      });
    }

    const index = builder.build();
    await this.fulltextIndexes.put({
      treeId,
      locale,
      updatedAt: Date.now(),
      dirty: false,
      serializedIndex: JSON.stringify(index.toJSON()),
    });
  }

  private configureLocalePipeline(builder: lunr.Builder, _locale: string): void {
    builder.pipeline.reset();
    builder.pipeline.add(lunr.trimmer, lunr.stopWordFilter, lunr.stemmer);
  }

  private async seedFulltextNodes(treeId: TreeId): Promise<void> {
    const existingCount = await this.fulltextNodes.where('treeId').equals(treeId).count();
    if (existingCount > 0) {
      return;
    }

    const prefix = `${treeId}:`;
    const nodes = await this.coreDB.nodes.where('id').startsWith(prefix).toArray();
    if (nodes.length === 0) {
      return;
    }

    const rows: FulltextNodeRecord[] = nodes.map((node) => ({
      treeId,
      nodeId: node.id,
      parentId: node.parentId,
      name: node.name ?? '',
      description: node.description ?? '',
      updatedAt: node.updatedAt ?? Date.now(),
    }));
    await this.fulltextNodes.bulkPut(rows);
  }

  private async collectAllowedNodes(rootNodeId: NodeId): Promise<Set<NodeId>> {
    const allowed = new Set<NodeId>([rootNodeId]);
    const descendants = await this.coreDB.listDescendants(rootNodeId);
    for (const node of descendants) {
      allowed.add(node.id);
    }
    return allowed;
  }

  private extractTreeId(nodeId: NodeId): TreeId {
    const separator = nodeId.indexOf(':');
    if (separator === -1) {
      return nodeId as unknown as TreeId;
    }
    return nodeId.slice(0, separator) as unknown as TreeId;
  }

  private async handleChangeEvent(event: TreeChangeEvent): Promise<void> {
    const treeId = this.extractTreeId(event.nodeId);
    const locales = await this.getLocalesForTree(treeId);

    switch (event.type) {
      case 'node-created':
      case 'node-updated':
      case 'node-moved':
        if (event.node) {
          await this.upsertNodeRecord(event.node);
          await this.rebuildLocales(treeId, locales);
        }
        break;
      case 'node-deleted':
        {
          await this.removeNodeRecord(event.nodeId);
          await this.rebuildLocales(treeId, locales);
        }
        break;
      default:
        break;
    }
  }

  private async getLocalesForTree(treeId: TreeId): Promise<string[]> {
    const records = await this.fulltextIndexes.where('treeId').equals(treeId).toArray();
    if (records.length === 0) {
      await this.fulltextIndexes.put({
        treeId,
        locale: DEFAULT_LOCALE,
        updatedAt: 0,
        dirty: true,
      });
      void this.scheduleRebuild(treeId, DEFAULT_LOCALE);
      return [DEFAULT_LOCALE];
    }
    const locales = Array.from(new Set(records.map((record) => record.locale)));
    if (!locales.includes(DEFAULT_LOCALE)) {
      locales.push(DEFAULT_LOCALE);
    }
    return locales;
  }

  private async upsertNodeRecord(node: TreeNode): Promise<FulltextNodeRecord> {
    const treeId = this.extractTreeId(node.id);
    const record: FulltextNodeRecord = {
      treeId,
      nodeId: node.id,
      parentId: node.parentId,
      name: node.name ?? '',
      description: node.description ?? '',
      updatedAt: Date.now(),
    };
    await this.fulltextNodes.put(record);
    return record;
  }

  private async removeNodeRecord(nodeId: NodeId): Promise<FulltextNodeRecord | undefined> {
    const treeId = this.extractTreeId(nodeId);
    const record = await this.fulltextNodes.get([treeId, nodeId]);
    await this.fulltextNodes.delete([treeId, nodeId]);
    return record;
  }

  private async rebuildLocales(treeId: TreeId, locales: string[]): Promise<void> {
    for (const locale of locales) {
      await this.scheduleRebuild(treeId, locale);
    }
  }

}
