/**
 * ExportService - ツリーノードとリソースのエクスポート処理
 * @module worker/services/ExportService
 */

import type {
  ExportManifest,
  ExportOptions,
  ExportProgress,
  ExportResult,
  TreeNodeExportData,
  TreeNode,
  NodeId,
} from '@hierarchidb/common-core';
import { CoreDB } from '../db/CoreDB';
import { TreeQueryService } from './TreeQueryService';

/**
 * エクスポートサービス
 * ツリーノードをJSON/ZIP形式でエクスポート
 */
export class ExportService {
  constructor(
    private coreDB: CoreDB,
    private queryService: TreeQueryService
  ) {}

  /**
   * ツリーノードをJSONとしてエクスポート
   */
  async exportToJSON(options: ExportOptions): Promise<ExportResult> {
    const { nodeIds, progressCallback } = options;

    try {
      // 進捗通知: ノード収集開始
      progressCallback?.({
        phase: 'collecting-nodes',
        current: 0,
        total: nodeIds.length,
        message: 'Collecting nodes for export',
      });

      // エクスポートするノードとその子孫を収集
      const exportData = await this.collectNodes(nodeIds, progressCallback);

      // マニフェストの作成
      const manifest: ExportManifest = {
        version: '1.0',
        name: 'HierarchiDB Export',
        description: `Exported ${exportData.nodeIds.length} nodes`,
        exportDate: new Date().toISOString(),
        exportedBy: 'HierarchiDB',
        appVersion: '1.0.0',
        nodeCount: exportData.nodeIds.length,
        resourceTypes: this.countResourceTypes(exportData.nodes),
        rootNodes: nodeIds,
      };

      // 進捗通知: アーカイブ作成
      progressCallback?.({
        phase: 'creating-archive',
        current: 1,
        total: 1,
        message: 'Creating export file',
      });

      // JSONデータの作成
      const exportPackage = {
        manifest,
        ...exportData,
      };

      // Blobの作成
      const jsonString = JSON.stringify(exportPackage, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      // 進捗通知: 完了
      progressCallback?.({
        phase: 'finalizing',
        current: 1,
        total: 1,
        message: 'Export completed successfully',
      });

      return {
        success: true,
        blob,
        exportedNodeCount: exportData.nodeIds.length,
        errors: [],
      };
    } catch (error) {
      console.error('Export failed:', error);
      return {
        success: false,
        exportedNodeCount: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
      };
    }
  }

  /**
   * ツリーノードをZIPとしてエクスポート（将来実装）
   */
  async exportToZIP(options: ExportOptions): Promise<ExportResult> {
    // ZIP形式のエクスポートは後続フェーズで実装
    // 現時点ではJSONエクスポートにフォールバック
    return this.exportToJSON(options);
  }

  /**
   * ノードとその子孫を収集
   */
  private async collectNodes(
    nodeIds: NodeId[],
    progressCallback?: (progress: ExportProgress) => void
  ): Promise<TreeNodeExportData> {
    const nodes: Record<NodeId, TreeNode> = {};
    const allNodeIds: NodeId[] = [];
    const visited = new Set<NodeId>();

    // 各ルートノードとその子孫を収集
    for (const [index, nodeId] of nodeIds.entries()) {
      progressCallback?.({
        phase: 'collecting-nodes',
        current: index + 1,
        total: nodeIds.length,
        message: `Collecting node ${index + 1} of ${nodeIds.length}`,
      });

      await this.collectNodeRecursive(nodeId, nodes, allNodeIds, visited);
    }

    // ツリーの深さを計算
    const treeDepth = this.calculateTreeDepth(nodes, nodeIds);

    return {
      nodes,
      nodeIds: allNodeIds,
      rootIds: nodeIds,
      metadata: {
        totalCount: allNodeIds.length,
        treeDepth,
      },
    };
  }

  /**
   * ノードを再帰的に収集
   */
  private async collectNodeRecursive(
    nodeId: NodeId,
    nodes: Record<NodeId, TreeNode>,
    nodeIds: NodeId[],
    visited: Set<NodeId>
  ): Promise<void> {
    // 既に訪問済みの場合はスキップ
    if (visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);

    // ノードを取得
    const node = await this.coreDB.getNode(nodeId);
    if (!node) {
      return;
    }

    // ノードを追加
    nodes[nodeId] = node;
    nodeIds.push(nodeId);

    // 子ノードを取得して再帰的に処理
    const children = await this.coreDB.listChildren(nodeId);
    for (const child of children) {
      await this.collectNodeRecursive(child.id, nodes, nodeIds, visited);
    }
  }

  /**
   * リソースタイプをカウント
   */
  private countResourceTypes(nodes: Record<NodeId, TreeNode>): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const node of Object.values(nodes)) {
      const type = node.nodeType;
      if (type && type !== 'folder') {
        counts[type] = (counts[type] || 0) + 1;
      }
    }

    return counts;
  }

  /**
   * ツリーの深さを計算
   */
  private calculateTreeDepth(nodes: Record<NodeId, TreeNode>, rootIds: NodeId[]): number {
    let maxDepth = 0;

    const calculateDepthRecursive = (nodeId: NodeId, depth: number): void => {
      maxDepth = Math.max(maxDepth, depth);

      // 子ノードを探す
      for (const node of Object.values(nodes)) {
        if (node.parentId === nodeId) {
          calculateDepthRecursive(node.id, depth + 1);
        }
      }
    };

    // 各ルートノードから深さを計算
    for (const rootId of rootIds) {
      calculateDepthRecursive(rootId, 1);
    }

    return maxDepth;
  }

  /**
   * エクスポートファイル名の生成
   */
  static generateFileName(prefix: string = 'export'): string {
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${prefix}_${timestamp}.json`;
  }
}
