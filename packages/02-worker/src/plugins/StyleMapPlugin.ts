import type { NodeId, TreeNodeType, TreeId } from '@hierarchidb/00-core';
import { StyleMapDB, type StyleMapEntity, type SpreadsheetMetadataId } from '../db/StyleMapDB';
import { StyleMapWorkerHandler } from '../handlers/StyleMapWorkerHandler';
import type { PluginDefinition } from '../registry/plugin';

// Local type definitions for plugin-specific types
type StyleMapColorRule = {
  id: string;
  condition: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'range';
  value: string | number;
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
  enabled: boolean;
};

type StyleMapStyle = {
  backgroundColor?: string;
  textColor?: string;
  borderColor?: string;
};

/**
 * StyleMap Plugin Definition for Worker
 * Registers stylemap as a practical TreeNode type for data visualization
 */
export function createStyleMapPlugin(): PluginDefinition {
  const styleMapDB = new StyleMapDB();
  const handler = new StyleMapWorkerHandler(styleMapDB);

  return {
    nodeType: 'stylemap' as TreeNodeType,
    name: 'StyleMap',
    displayName: 'スタイルマップ',
    category: {
    treeId: '*' as TreeId | '*',
    menuGroup: 'advanced' as const
  },
    
    meta: {
      id: 'com.hierarchidb.stylemap',
      name: 'StyleMap',
      nodeType: 'stylemap' as TreeNodeType,
      version: '1.0.0',
      author: 'HierarchiDB Team',
      status: 'active' as const,
      tags: ['visualization', 'map', 'style', 'data'],
      dependencies: ['com.hierarchidb.spreadsheet'], // スプレッドシートプラグインに依存
      capabilities: {
        supportsCreate: true,
        supportsUpdate: true,
        supportsDelete: true,
        supportsChildren: false,
        supportedOperations: ['create', 'read', 'update', 'delete']
      },
      // EntityReferenceHints for 3x2 lifecycle management
      entityHints: {
        relRefField: 'spreadsheetMetadataId'
      }
    },

    database: {
      dbName: 'hierarchidb-stylemap',
      tableName: 'styleMapEntities',
      schema: '&nodeId, spreadsheetMetadataId, updatedAt',
      version: 1
    },

    entityHandler: handler as any,
    
    /*entityHandler: {
      // 基本的なエンティティ操作
      async createEntity(nodeId: NodeId, data?: Partial<StyleMapEntity>): Promise<StyleMapEntity> {
        if (!data?.spreadsheetMetadataId) {
          throw new Error('spreadsheetMetadataId is required for StyleMap');
        }

        const entity: StyleMapEntity = {
          nodeId,
          spreadsheetMetadataId: data.spreadsheetMetadataId,
          keyColumn: data.keyColumn || '',
          colorRules: data.colorRules || [],
          defaultStyle: data.defaultStyle || {
            backgroundColor: '#e0e0e0',
            textColor: '#000000'
          },
          description: data.description,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
          ...data
        };

        await handler.createStyleMapEntity(entity);
        return entity;
      },

      async getEntity(nodeId: NodeId): Promise<StyleMapEntity | undefined> {
        const entity = await handler.getStyleMapEntity(nodeId);
        return entity || undefined;
      },

      async updateEntity(nodeId: NodeId, data: Partial<StyleMapEntity>): Promise<void> {
        await handler.updateStyleMapEntity(nodeId, data);
      },

      async deleteEntity(nodeId: NodeId): Promise<void> {
        // LifecycleManagerが自動的に参照カウント管理を行う
        await handler.deleteStyleMapEntity(nodeId);
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

    // StyleMap-specific API methods
    routing: {
      actions: {
        // 既存スプレッドシートからStyleMap作成
        'create-from-spreadsheet': {
          action: async () => {
            const [nodeId, spreadsheetMetadataId, config] = arguments as unknown as [
              NodeId, 
              SpreadsheetMetadataId,
              {
                keyColumn: string;
                colorRules: StyleMapColorRule[];
                defaultStyle: StyleMapStyle;
                description?: string;
              }
            ];
            const entity: StyleMapEntity = {
              nodeId,
              spreadsheetMetadataId,
              keyColumn: config.keyColumn,
              colorRules: config.colorRules,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              version: 1
            };
            
            await handler.createStyleMapEntity(entity);
            return entity;
          }
        },

        // スタイル設定更新
        'update-styling': {
          action: async () => {
            const [nodeId, updates] = arguments as unknown as [
              NodeId,
              {
                keyColumn?: string;
                colorRules?: StyleMapColorRule[];
                defaultStyle?: StyleMapStyle;
                description?: string;
              }
            ];
            await handler.updateStyleMapEntity(nodeId, updates);
            return await handler.getStyleMapEntity(nodeId);
          }
        },

        // スタイル適用後のデータ取得
        'get-styled-data': {
          action: async () => {
            const [nodeId, options] = arguments as unknown as [NodeId, {
              limit?: number;
              offset?: number;
            }?];
          const styleMap = await handler.getStyleMapEntity(nodeId);
          if (!styleMap) {
            throw new Error(`StyleMap not found for node ${nodeId}`);
          }

          // TODO: Implement styled data generation
          // 1. スプレッドシートデータを取得
          // 2. colorRulesを適用してスタイル情報を付与
          // 3. 結果を返す
          
            return {
              styleMap,
              styledRows: [], // TODO: 実装
              totalRows: 0
            };
          }
        },

        // プレビューデータ取得
        'get-preview': {
          action: async () => {
            const [nodeId, sampleSize = 100] = arguments as unknown as [NodeId, number?];
          const styleMap = await handler.getStyleMapEntity(nodeId);
          if (!styleMap) {
            throw new Error(`StyleMap not found for node ${nodeId}`);
          }

          // TODO: Implement preview generation
            return {
              sampleRows: [], // TODO: 実装
              styleMap,
              columnInfo: {}
            };
          }
        },

        // 統計情報取得
        'get-style-stats': {
          action: async () => {
            const [nodeId] = arguments as unknown as [NodeId];
          const styleMap = await handler.getStyleMapEntity(nodeId);
          if (!styleMap) {
            throw new Error(`StyleMap not found for node ${nodeId}`);
          }

            return {
              totalRules: styleMap.colorRules.length,
              keyColumn: styleMap.keyColumn,
              hasDefaultStyle: false, // defaultStyle not in StyleMapEntity
              lastUpdated: styleMap.updatedAt
            };
          }
        }
      }
    },

    ui: {
      iconComponentPath: 'stylemap',
      dialogComponentPath: 'StyleMapDialog', 
      panelComponentPath: 'StyleMapPanel'
    },

    validation: {
      allowedChildTypes: [], // StyleMapは子ノードを持たない
      maxChildren: 0,
      customValidators: [
        {
          name: 'has-spreadsheet-data',
          validate: async (entity: any) => {
            const styleMapEntity = entity as StyleMapEntity;
            // TODO: スプレッドシートデータの存在確認
            if (!styleMapEntity.spreadsheetMetadataId) {
              return { valid: false, message: '参照するスプレッドシートが指定されていません' };
            }
            return { valid: true };
          }
        },
        {
          name: 'valid-key-column',
          validate: async (entity: any) => {
            const styleMapEntity = entity as StyleMapEntity;
            if (!styleMapEntity.keyColumn) {
              return { valid: false, message: 'キーカラムが指定されていません' };
            }
            return { valid: true };
          }
        }
      ]
    },

    lifecycle: {
      afterCreate: async (nodeId: NodeId, entity: any) => {
        const styleMapEntity = entity as StyleMapEntity;
        console.log(`StyleMap created: ${nodeId} -> ${styleMapEntity.spreadsheetMetadataId}`);
      },

      beforeDelete: async (nodeId: NodeId) => {
        console.log(`Deleting StyleMap: ${nodeId}`);
      },

      afterDelete: async (nodeId: NodeId) => {
        console.log(`StyleMap deleted: ${nodeId}`);
      }
    }
  };
}

/**
 * Register StyleMap plugin with the registry
 */
export function registerStyleMapPlugin(registry: any): void {
  const plugin = createStyleMapPlugin();
  registry.registerPlugin(plugin);
  console.log('StyleMap plugin registered');
}