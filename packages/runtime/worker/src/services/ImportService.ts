/**
 * ImportService - ツリーノードとリソースのインポート処理
 * @module worker/services/ImportService
 */

import type {
  ImportManifest,
  ImportProgress,
  ImportResult,
  TemplateImportOptions,
  FileImportOptions,
  TreeNodeExportData,
  TreeNode,
  NodeId,
  IdMapping,
  CommandEnvelope,
  ImportNodesPayload,
} from '@hierarchidb/common-core';
import type { CoreDB } from '../db/CoreDB';
import type { TreeMutationService } from './TreeMutationService';
// Use native crypto.randomUUID() instead of uuid package

/**
 * インポートサービス
 * テンプレートやZIPファイルからのインポート処理を管理
 */
export class ImportService {
  constructor(
    private coreDB: CoreDB,
    private mutationService: TreeMutationService
  ) {}

  /**
   * テンプレートからインポート
   */
  async importFromTemplate(options: TemplateImportOptions): Promise<ImportResult> {
    const { templateId, targetParentId, mergeStrategy = 'rename', progressCallback } = options;

    try {
      // 進捗通知: 読み込み開始
      progressCallback?.({
        phase: 'reading',
        current: 0,
        total: 1,
        message: `Loading template: ${templateId}`,
      });

      // テンプレートマニフェストの読み込み
      const manifestResponse = await fetch(`/templates/${templateId}/manifest.json`);
      if (!manifestResponse.ok) {
        throw new Error(`Template not found: ${templateId}`);
      }
      const manifest: ImportManifest = await manifestResponse.json();

      // 進捗通知: 検証
      progressCallback?.({
        phase: 'validating',
        current: 1,
        total: 1,
        message: 'Validating template data',
      });

      // ツリーノードデータの読み込み
      const nodesResponse = await fetch(`/templates/${templateId}/tree-nodes.json`);
      if (!nodesResponse.ok) {
        throw new Error(`Template data not found: ${templateId}`);
      }
      const treeData: TreeNodeExportData = await nodesResponse.json();

      // 進捗通知: インポート開始
      progressCallback?.({
        phase: 'importing-nodes',
        current: 0,
        total: treeData.nodeIds.length,
        message: `Importing ${treeData.nodeIds.length} nodes`,
      });

      // IDマッピングの作成（テンプレートID → 新規string）
      const idMapping: IdMapping = new Map();
      const newNodes: Record<NodeId, TreeNode> = {};
      const newNodeIds: NodeId[] = [];

      // 各ノードに新しいIDを割り当て
      for (const [index, oldId] of treeData.nodeIds.entries()) {
        const newId = crypto.randomUUID() as NodeId;
        idMapping.set(oldId, newId);
        newNodeIds.push(newId);

        const oldNode = treeData.nodes[oldId];
        if (oldNode) {
          // 親ノードIDの更新
          let newParentId: NodeId | null = null;
          if (oldNode.parentId) {
            newParentId = idMapping.get(oldNode.parentId) || targetParentId;
          } else {
            // ルートノードの場合、targetParentIdを親に設定
            newParentId = targetParentId;
          }

          // 新しいノードの作成
          newNodes[newId] = {
            ...oldNode,
            id: newId,
            parentId: newParentId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          };

          // 進捗更新
          progressCallback?.({
            phase: 'importing-nodes',
            current: index + 1,
            total: treeData.nodeIds.length,
            message: `Importing node: ${oldNode.name}`,
          });
        }
      }

      // 名前衝突の処理
      if (mergeStrategy === 'rename') {
        await this.handleNameConflicts(newNodes, targetParentId);
      }

      // importNodesコマンドの実行
      const command: CommandEnvelope<'importNodes', ImportNodesPayload> = {
        payload: {
          nodes: newNodes,
          nodeIds: newNodeIds,
          toParentId: targetParentId,
          onNameConflict: mergeStrategy === 'rename' ? 'auto-rename' : 'error',
        },
        commandId: `import-template-${Date.now()}`,
        groupId: `template-${templateId}`,
        kind: 'importNodes',
        issuedAt: Date.now(),
      };

      const result = await this.mutationService.importNodes(command);

      // 進捗通知: 完了
      progressCallback?.({
        phase: 'finalizing',
        current: 1,
        total: 1,
        message: 'Import completed successfully',
      });

      return {
        success: result.success,
        importedNodeIds: newNodeIds,
        skippedNodes: 0,
        errors: result.success ? [] : ['error' in result ? result.error : 'Import failed'],
        warnings: [],
      };
    } catch (error) {
      console.error('Import failed:', error);
      return {
        success: false,
        importedNodeIds: [],
        skippedNodes: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
      };
    }
  }

  /**
   * ZIPファイルからインポート
   */
  async importFromFile(options: FileImportOptions): Promise<ImportResult> {
    const { file, targetParentId, mergeStrategy = 'rename', progressCallback } = options;

    // 進捗通知: 読み込み開始
    progressCallback?.({
      phase: 'reading',
      current: 0,
      total: 1,
      message: `Reading file: ${file.name}`,
    });

    // ZIPファイル処理の実装は後続フェーズで追加
    // 現時点では基本的なJSONファイル読み込みのみサポート
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // JSONデータをツリーノードとして処理
      if (data.nodes && data.nodeIds) {
        // tree-nodes.json形式として処理
        return this.importTreeNodes(data, targetParentId, mergeStrategy, progressCallback);
      } else {
        throw new Error('Invalid file format. Expected tree-nodes.json structure.');
      }
    } catch (error) {
      return {
        success: false,
        importedNodeIds: [],
        skippedNodes: 0,
        errors: [error instanceof Error ? error.message : 'Failed to parse file'],
      };
    }
  }

  /**
   * ツリーノードデータのインポート（内部処理）
   */
  private async importTreeNodes(
    treeData: TreeNodeExportData,
    targetParentId: NodeId,
    mergeStrategy: 'skip' | 'replace' | 'rename',
    progressCallback?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    // テンプレートインポートと同様の処理
    const idMapping: IdMapping = new Map();
    const newNodes: Record<NodeId, TreeNode> = {};
    const newNodeIds: NodeId[] = [];

    progressCallback?.({
      phase: 'importing-nodes',
      current: 0,
      total: treeData.nodeIds.length,
      message: `Importing ${treeData.nodeIds.length} nodes`,
    });

    // 各ノードに新しいIDを割り当て
    for (const [index, oldId] of treeData.nodeIds.entries()) {
      const newId = crypto.randomUUID() as NodeId;
      idMapping.set(oldId, newId);
      newNodeIds.push(newId);

      const oldNode = treeData.nodes[oldId];
      if (oldNode) {
        let newParentId: NodeId | null = null;
        if (oldNode.parentId) {
          newParentId = idMapping.get(oldNode.parentId) || targetParentId;
        } else {
          newParentId = targetParentId;
        }

        newNodes[newId] = {
          ...oldNode,
          id: newId,
          parentId: newParentId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        };

        progressCallback?.({
          phase: 'importing-nodes',
          current: index + 1,
          total: treeData.nodeIds.length,
          message: `Importing: ${oldNode.name}`,
        });
      }
    }

    // importNodesコマンドの実行
    const command: CommandEnvelope<'importNodes', ImportNodesPayload> = {
      payload: {
        nodes: newNodes,
        nodeIds: newNodeIds,
        toParentId: targetParentId,
        onNameConflict: mergeStrategy === 'rename' ? 'auto-rename' : 'error',
      },
      commandId: `import-file-${Date.now()}`,
      groupId: `import-${Date.now()}`,
      kind: 'importNodes',
      issuedAt: Date.now(),
    };

    const result = await this.mutationService.importNodes(command);

    progressCallback?.({
      phase: 'finalizing',
      current: 1,
      total: 1,
      message: 'Import completed',
    });

    return {
      success: result.success,
      importedNodeIds: newNodeIds,
      skippedNodes: 0,
      errors: result.success ? [] : ['error' in result ? result.error : 'Import failed'],
    };
  }

  /**
   * 名前衝突の処理
   */
  private async handleNameConflicts(
    nodes: Record<NodeId, TreeNode>,
    parentId: NodeId
  ): Promise<void> {
    // 既存の子ノードを取得
    const existingChildren = await this.coreDB.listChildren(parentId);
    const existingNames = new Set(existingChildren.map((node: TreeNode) => node.name));

    // 衝突するノードの名前を変更
    for (const node of Object.values(nodes)) {
      if (node.parentId === parentId && existingNames.has(node.name)) {
        // 名前に番号を追加
        let counter = 1;
        let newName = `${node.name} (${counter})`;
        while (existingNames.has(newName)) {
          counter++;
          newName = `${node.name} (${counter})`;
        }
        node.name = newName;
        existingNames.add(newName);
      }
    }
  }
}
