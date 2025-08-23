import type { NodeId, TreeNodeType, TreeId } from '@hierarchidb/00-core';
import { SpreadsheetDB, type SpreadsheetMetadata, type SpreadsheetRefEntity, type SpreadsheetChunk, type SpreadsheetMetadataId } from '../db/SpreadsheetDB';
import { SpreadsheetWorkerHandler } from '../handlers/SpreadsheetWorkerHandler';
import type { PluginDefinition } from '../registry/plugin';

// Local type definitions for plugin-specific types
type SpreadsheetImportOptions = {
  hasHeader?: boolean;
  delimiter?: string;
  encoding?: string;
};

/**
 * Spreadsheet Plugin Definition for Worker
 * Registers spreadsheet as a practical TreeNode type for table data management
 */
export function createSpreadsheetPlugin(): PluginDefinition {
  const spreadsheetDB = new SpreadsheetDB();
  const handler = new SpreadsheetWorkerHandler(spreadsheetDB);

  return {
    nodeType: 'spreadsheet' as TreeNodeType,
    name: 'Spreadsheet',
    displayName: 'スプレッドシート',
    category: {
    treeId: '*' as TreeId | '*',
    menuGroup: 'document' as const
  },
    
    meta: {
      id: 'com.hierarchidb.spreadsheet',
      name: 'Spreadsheet',
      nodeType: 'spreadsheet' as TreeNodeType,
      version: '1.0.0',
      author: 'HierarchiDB Team',
      status: 'active' as const,
      tags: ['data', 'table', 'csv', 'excel'],
      capabilities: {
        supportsCreate: true,
        supportsUpdate: true,
        supportsDelete: true,
        supportsChildren: false,
        supportedOperations: ['create', 'read', 'update', 'delete']
      },
      // EntityReferenceHints for 3x2 lifecycle management
      entityHints: {
        relRefField: 'metadataId'
      }
    },

    database: {
      dbName: 'hierarchidb-spreadsheet',
      tableName: 'spreadsheetRefs',
      schema: '&nodeId, metadataId, updatedAt',
      version: 1
    },

    entityHandler: handler as any,
    
    /*entityHandler: {
      // 基本的なエンティティ操作
      async createEntity(nodeId: NodeId, data?: Partial<SpreadsheetRefEntity>): Promise<SpreadsheetRefEntity> {
        const entity: SpreadsheetRefEntity = {
          nodeId,
          metadataId: data?.metadataId || '' as any, // Will be set by import methods
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
          ...data
        };

        await handler.createSpreadsheetRef(entity);
        return entity;
      },

      async getEntity(nodeId: NodeId): Promise<SpreadsheetRefEntity | undefined> {
        const entity = await handler.getPeerEntity(nodeId);
        return entity || undefined;
      },

      async updateEntity(nodeId: NodeId, data: Partial<SpreadsheetRefEntity>): Promise<void> {
        const existing = await handler.getSpreadsheetRef(nodeId);
        if (!existing) {
          throw new Error(`SpreadsheetRefEntity not found for node ${nodeId}`);
        }

        const updated: SpreadsheetRefEntity = {
          ...existing,
          ...data,
          updatedAt: Date.now(),
          version: existing.version + 1
        };

        await handler.createSpreadsheetRef(updated); // Dexie put operation
      },

      async deleteEntity(nodeId: NodeId): Promise<void> {
        // LifecycleManagerが自動的に参照カウント管理を行う
        await handler.deleteSpreadsheetRef(nodeId);
      },

      // Working copy operations (simplified for now)
      async createWorkingCopy(nodeId: NodeId): Promise<any> {
        const entity = await this.getEntity(nodeId);
        return { ...entity, isDraft: true };
      },

      async commitWorkingCopy(nodeId: NodeId, workingCopy: any): Promise<void> {
        await this.updateEntity(nodeId, workingCopy);
      },

      async discardWorkingCopy(nodeId: NodeId): Promise<void> {
        // No-op for now
      }
    },*/

    // Spreadsheet-specific API methods
    routing: {
      actions: {
        // ファイルからインポート
        'import-file': {
          action: async () => {
            const [nodeId, file, options] = arguments as unknown as [NodeId, File, SpreadsheetImportOptions?];
          // TODO: Implement file import logic
          // 1. FileLoaderでファイルを解析
          // 2. SpreadsheetMetadataを作成
          // 3. チャンク化してSpreadsheetChunksに保存
          // 4. SpreadsheetRefEntityを作成
          throw new Error('File import not yet implemented');
          }
        },

        // URLからインポート
        'import-url': {
          action: async () => {
            const [nodeId, url, options] = arguments as unknown as [NodeId, string, SpreadsheetImportOptions?];
            // TODO: Implement URL import logic
            throw new Error('URL import not yet implemented');
          }
        },

        // クリップボードからインポート
        'import-clipboard': {
          action: async () => {
            const [nodeId, text, options] = arguments as unknown as [NodeId, string, SpreadsheetImportOptions?];
            // TODO: Implement clipboard import logic
            throw new Error('Clipboard import not yet implemented');
          }
        },

        // データ取得
        'get-data': {
          action: async () => {
            const [nodeId, options] = arguments as unknown as [NodeId, { startRow?: number; endRow?: number }?];
          const ref = await handler.getSpreadsheetRef(nodeId);
          if (!ref) {
            throw new Error(`Spreadsheet not found for node ${nodeId}`);
          }

          const metadata = await handler.getSpreadsheetMetadata(ref.metadataId);
          const chunks = await handler.getSpreadsheetChunks(ref.metadataId);

          // Update last accessed
          await handler.updateLastAccessed(ref.metadataId);

          return { metadata, chunks };
          }
        },

        // 行データ取得
        'get-rows': {
          action: async () => {
            const [nodeId, options] = arguments as unknown as [NodeId, { 
              startRow?: number; 
              endRow?: number; 
              columns?: string[];
            }?];
            // TODO: Implement row extraction with filtering
            throw new Error('Row extraction not yet implemented');
          }
        },

        // 統計情報取得
        'get-stats': {
          action: async () => {
            const [nodeId] = arguments as unknown as [NodeId];
          const ref = await handler.getSpreadsheetRef(nodeId);
          if (!ref) {
            throw new Error(`Spreadsheet not found for node ${nodeId}`);
          }

          const metadata = await handler.getSpreadsheetMetadata(ref.metadataId);
          return {
            rowCount: metadata?.rowCount || 0,
            columnCount: metadata?.columnCount || 0,
            fileSize: metadata?.fileSize || 0,
            columns: metadata?.columns || [],
            lastAccessed: metadata?.lastAccessedAt
          };
          }
        }
      }
    },

    ui: {
      iconComponentPath: 'spreadsheet',
      dialogComponentPath: 'SpreadsheetDialog',
      panelComponentPath: 'SpreadsheetPanel'
    },

    validation: {
      allowedChildTypes: [], // スプレッドシートは子ノードを持たない
      maxChildren: 0,
      customValidators: [
        {
          name: 'has-data',
          validate: async (entity: any) => {
            const spreadsheetEntity = entity as SpreadsheetRefEntity;
            const metadata = await handler.getSpreadsheetMetadata(spreadsheetEntity.metadataId);
            if (!metadata) {
              return { valid: false, message: 'スプレッドシートデータが見つかりません' };
            }
            return { valid: true };
          }
        }
      ]
    },

    lifecycle: {
      afterCreate: async (nodeId: NodeId, entity: any) => {
        const spreadsheetEntity = entity as SpreadsheetRefEntity;
        console.log(`Spreadsheet created: ${nodeId} -> ${spreadsheetEntity.metadataId}`);
      },

      beforeDelete: async (nodeId: NodeId) => {
        console.log(`Deleting spreadsheet: ${nodeId}`);
      },

      afterDelete: async (nodeId: NodeId) => {
        console.log(`Spreadsheet deleted: ${nodeId}`);
      }
    }
  };
}

/**
 * Register spreadsheet plugin with the registry
 */
export function registerSpreadsheetPlugin(registry: any): void {
  const plugin = createSpreadsheetPlugin();
  registry.registerPlugin(plugin);
  console.log('Spreadsheet plugin registered');
}