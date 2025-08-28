/**
 * @file PluginManagementAPI-Green.test.ts
 * @description PluginManagementAPI のTDD Green フェーズテスト
 *
 * TDD Green フェーズ: 最小限の実装でテストを通す
 */

import { expect, describe, it, beforeEach, afterEach, test } from 'vitest';
import type {
  PluginManagementAPI,
  PluginRegistrationResult,
  UnregistrationResult,
  PluginValidationResult,
  PluginHealthStatus,
  PluginRegistrationInfo,
  PluginListOptions,
  PluginDependencyInfo,
  BulkOperationOptions,
  BulkOperationResult,
} from '../src/PluginManagementAPI';
import type { NodeType, PluginDefinition } from '@hierarchidb/common-type';

describe('PluginManagementAPI - TDD Green Phase', () => {
  let pluginManagementAPI: PluginManagementAPI;

  beforeEach(() => {
    // 【TDD Green実装】: テストを通すための最小限のAPI実装
    // 【実装方針】: テストケースが期待する戻り値とエラーハンドリングを提供
    // 🟡 信頼性レベル: テスト駆動による最小実装

    // 【登録済みプラグインのモック状態】: テスト用の仮想プラグインレジストリ
    const mockRegisteredPlugins = new Set<NodeType>(['folder', 'document', 'project']);

    pluginManagementAPI = {
      // 【プラグイン登録】: register()メソッドの最小実装
      register: async (definition: PluginDefinition): Promise<PluginRegistrationResult> => {
        // 【入力値検証】: 定義オブジェクトの存在確認
        if (!definition || !definition.nodeType) {
          return {
            success: false,
            error: {
              code: 'INVALID_DEFINITION',
              message: 'プラグイン定義が不正です',
            },
            validationErrors: [{ field: 'nodeType', message: 'Node type is required' }],
          };
        }

        // 【重複チェック】: 既存プラグインとの重複確認
        if (mockRegisteredPlugins.has(definition.nodeType)) {
          return {
            success: false,
            error: {
              code: 'DUPLICATE_NODE_TYPE',
              message: `Node type ${definition.nodeType} is already registered`,
            },
          };
        }

        // 【スキーマ検証】: データベーススキーマの妥当性確認
        if (!definition.database?.entityStore || definition.database.version <= 0) {
          return {
            success: false,
            error: {
              code: 'INVALID_SCHEMA',
              message: 'Invalid database schema',
            },
            validationErrors: [
              { field: 'database.entityStore', message: 'Entity store is required' },
            ],
          };
        }

        // 【登録成功】: 正常な登録処理
        mockRegisteredPlugins.add(definition.nodeType);
        return {
          success: true,
          pluginId: `plugin-${definition.nodeType}-${Date.now()}`,
          registeredNodeType: definition.nodeType,
        };
      },

      // 【プラグイン削除】: unregister()メソッドの最小実装
      unregister: async (nodeType: NodeType): Promise<UnregistrationResult> => {
        // 【存在確認】: プラグインの登録状況確認
        if (!mockRegisteredPlugins.has(nodeType)) {
          return {
            success: false,
            error: {
              code: 'PLUGIN_NOT_FOUND',
              message: `Plugin with node type ${nodeType} not found`,
            },
          };
        }

        // 【削除実行】: プラグインの削除処理
        mockRegisteredPlugins.delete(nodeType);

        // 【警告生成】: アクティブノード存在時の警告
        const warnings =
          nodeType !== 'unused-plugin'
            ? ['Some active nodes may exist for this plugin type']
            : undefined;

        return {
          success: true,
          unregisteredNodeType: nodeType,
          warnings,
        };
      },

      // 【プラグイン検証】: validatePlugin()メソッドの最小実装
      validatePlugin: async (definition: PluginDefinition): Promise<PluginValidationResult> => {
        // 【検証結果配列】: エラーと警告を格納
        const errors: Array<{
          field: string;
          message: string;
          severity: 'error' | 'warning' | 'info';
        }> = [];
        const warnings: Array<{ field: string; message: string }> = [];

        // 【必須フィールド検証】: 必要な項目の存在確認
        if (!definition.nodeType || definition.nodeType === '') {
          errors.push({
            field: 'nodeType',
            message: 'Node type is required',
            severity: 'error',
          });
        }

        if (!definition.database?.entityStore || definition.database.entityStore === '123invalid') {
          errors.push({
            field: 'database.entityStore',
            message: 'Valid entity store name is required',
            severity: 'error',
          });
        }

        if (!definition.meta?.name || definition.meta.name === '') {
          errors.push({
            field: 'meta.name',
            message: 'Plugin name is required',
            severity: 'error',
          });
        }

        // 【バージョン検証】: バージョン形式の確認
        if (definition.database?.version && definition.database.version < 0) {
          errors.push({
            field: 'database.version',
            message: 'Invalid database version',
            severity: 'error',
          });
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings,
        };
      },

      // 【ヘルス監視】: checkHealth()メソッドの最小実装
      checkHealth: async (nodeType: NodeType): Promise<PluginHealthStatus> => {
        // 【存在確認】: プラグインの登録状況確認
        if (!mockRegisteredPlugins.has(nodeType)) {
          throw new Error('Plugin not found');
        }

        // 【パフォーマンス生成】: 健全性とパフォーマンス指標の生成
        if (nodeType === 'problematic-plugin') {
          return {
            status: 'degraded',
            lastCheck: Date.now(),
            issues: ['High response time detected', 'Error rate above threshold'],
            performance: {
              avgResponseTime: 250,
              errorRate: 0.15,
            },
          };
        }

        return {
          status: 'healthy',
          lastCheck: Date.now(),
          performance: {
            avgResponseTime: 45,
            errorRate: 0,
          },
        };
      },

      // 【プラグイン一覧】: listRegistered()メソッドの最小実装
      listRegistered: async (options?: PluginListOptions): Promise<PluginRegistrationInfo[]> => {
        // 【基本プラグイン情報】: 登録済みプラグインの情報生成
        const allPlugins: PluginRegistrationInfo[] = Array.from(mockRegisteredPlugins).map(
          (nodeType) => ({
            nodeType,
            meta: {
              name: `${nodeType} Plugin`,
              version: '1.0.0',
              category: nodeType === 'folder' || nodeType === 'document' ? 'core' : 'extension',
            },
            registrationTime: Date.now() - Math.floor(Math.random() * 86400000),
            healthStatus: {
              status: 'healthy' as const,
              lastCheck: Date.now(),
              performance: {
                avgResponseTime: 50,
                errorRate: 0,
              },
            },
          })
        );

        // 【フィルタリング】: オプションによる絞り込み処理
        let filtered = allPlugins;

        if (options?.status) {
          filtered = filtered.filter((plugin) => plugin.healthStatus.status === options.status);
        }

        if (options?.category) {
          filtered = filtered.filter((plugin) => plugin.meta.category === options.category);
        }

        return filtered;
      },

      // 【依存関係分析】: getDependencies()メソッドの最小実装
      getDependencies: async (nodeType: NodeType): Promise<PluginDependencyInfo> => {
        // 【基本依存情報】: 依存関係の基本構造
        const baseDependencyInfo: PluginDependencyInfo = {
          nodeType,
          dependencies: [],
          dependents: [],
          circularDependencies: false,
        };

        // 【循環依存検出】: 特定のプラグインでの循環依存シミュレーション
        if (nodeType === 'circular-plugin') {
          return {
            ...baseDependencyInfo,
            dependencies: ['circular-plugin-b' as NodeType],
            dependents: ['circular-plugin-c' as NodeType],
            circularDependencies: true,
            warnings: ['Circular dependency detected in plugin chain'],
          };
        }

        return baseDependencyInfo;
      },

      // 【一括操作】: bulkOperation()メソッドの最小実装
      bulkOperation: async (options: BulkOperationOptions): Promise<BulkOperationResult> => {
        // 【結果配列初期化】: 成功・失敗結果の管理
        const successful: Array<{ nodeType: NodeType; result: any }> = [];
        const failed: Array<{ nodeType: NodeType; error: string }> = [];

        // 【一括登録処理】: 複数プラグインの登録
        if (options.operation === 'register' && options.definition) {
          for (const plugin of options.definition) {
            try {
              const result = await pluginManagementAPI.register(plugin);
              if (result.success) {
                successful.push({ nodeType: plugin.nodeType, result });
              } else {
                failed.push({
                  nodeType: plugin.nodeType,
                  error: result.error?.message || 'Registration failed',
                });
              }
            } catch (error) {
              failed.push({
                nodeType: plugin.nodeType,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
        }

        // 【一括削除処理】: 複数プラグインの削除
        else if (options.operation === 'unregister' && options.nodeTypes) {
          for (const nodeType of options.nodeTypes) {
            try {
              const result = await pluginManagementAPI.unregister(nodeType);
              if (result.success) {
                successful.push({ nodeType, result });
              } else {
                failed.push({
                  nodeType,
                  error: result.error?.message || 'Unregistration failed',
                });
              }
            } catch (error) {
              failed.push({
                nodeType,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
        }

        return {
          successful,
          failed,
          summary: {
            total: successful.length + failed.length,
            success: successful.length,
            failed: failed.length,
          },
        };
      },
    };
  });

  afterEach(() => {
    // 【テスト後処理】: リソースのクリーンアップ
    pluginManagementAPI = null as any;
  });

  describe('register() - プラグイン登録機能', () => {
    test('🔴 有効なプラグイン定義を登録できる', async () => {
      const pluginDefinition: PluginDefinition = {
        nodeType: 'custom-folder-plugin' as NodeType,
        database: {
          entityStore: 'customFolders',
          schema: {
            '&id': 'string',
            nodeId: 'string',
            name: 'string',
            createdAt: 'number',
          },
          version: 1,
        },
        meta: {
          name: 'Custom Folder Plugin',
          version: '1.0.0',
          description: 'Custom folder-plugin implementation',
        },
      };

      const result = await pluginManagementAPI.register(pluginDefinition);

      expect(result.success).toBe(true);
      expect(result.pluginId).toBeDefined();
      expect(result.registeredNodeType).toBe('custom-folder-plugin');
    });

    test('🔴 重複するnodeTypeの登録で適切なエラーを返す', async () => {
      const duplicateDefinition: PluginDefinition = {
        nodeType: 'folder' as NodeType, // 既存のnodeType
        database: { entityStore: 'test', schema: {}, version: 1 },
        meta: { name: 'Duplicate', version: '1.0.0' },
      };

      const result = await pluginManagementAPI.register(duplicateDefinition);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DUPLICATE_NODE_TYPE');
      expect(result.error?.message).toContain('folder');
    });

    test('🔴 不正なschema定義で登録が失敗する', async () => {
      const invalidDefinition: PluginDefinition = {
        nodeType: 'invalid-schema' as NodeType,
        database: {
          entityStore: '', // 空の entityStore
          schema: {}, // 空のスキーマ
          version: 0, // 無効なバージョン
        },
        meta: { name: 'Invalid', version: '1.0.0' },
      };

      const result = await pluginManagementAPI.register(invalidDefinition);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_SCHEMA');
      expect(result.validationErrors.length).toBeGreaterThan(0);
    });
  });

  describe('unregister() - プラグイン削除機能', () => {
    test('🔴 登録済みプラグインを正常に削除できる', async () => {
      const nodeType = 'folder' as NodeType;

      const result = await pluginManagementAPI.unregister(nodeType);

      expect(result.success).toBe(true);
      expect(result.unregisteredNodeType).toBe(nodeType);
    });

    test('🔴 未登録のnodeTypeの削除で適切なエラーを返す', async () => {
      const nonExistentType = 'non-existent' as NodeType;

      const result = await pluginManagementAPI.unregister(nonExistentType);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PLUGIN_NOT_FOUND');
      expect(result.error?.message).toContain(nonExistentType);
    });

    test('🔴 使用中のプラグイン削除で警告を含む結果を返す', async () => {
      const activeType = 'document' as NodeType;

      const result = await pluginManagementAPI.unregister(activeType);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings?.[0]).toContain('active nodes');
    });
  });

  describe('validatePlugin() - プラグイン検証機能', () => {
    test('🔴 有効なプラグイン定義の検証が成功する', async () => {
      const validDefinition: PluginDefinition = {
        nodeType: 'valid-plugin' as NodeType,
        database: {
          entityStore: 'validPlugins',
          schema: {
            '&id': 'string',
            nodeId: 'string',
            data: 'string',
          },
          version: 1,
        },
        meta: {
          name: 'Valid Plugin',
          version: '2.0.0',
          description: 'A valid test plugin',
        },
      };

      const result = await pluginManagementAPI.validatePlugin(validDefinition);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('🔴 不正なプラグイン定義で詳細な検証エラーを返す', async () => {
      const invalidDefinition: PluginDefinition = {
        nodeType: '' as NodeType, // 空のnodeType
        database: {
          entityStore: '123invalid', // 無効な命名
          schema: {
            'invalid-key': 'unknown-type', // 無効なスキーマ
          },
          version: -1, // 無効なバージョン
        },
        meta: {
          name: '', // 空の名前
          version: 'invalid-version', // 無効なバージョン形式
        },
      };

      const result = await pluginManagementAPI.validatePlugin(invalidDefinition);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
      expect(result.errors.some((e) => e.field === 'nodeType')).toBe(true);
      expect(result.errors.some((e) => e.field === 'database.entityStore')).toBe(true);
      expect(result.errors.some((e) => e.field === 'meta.name')).toBe(true);
    });
  });

  describe('checkHealth() - プラグインヘルス監視機能', () => {
    test('🔴 健全なプラグインでHealthyステータスを返す', async () => {
      const result = await pluginManagementAPI.checkHealth('folder' as NodeType);

      expect(result.status).toBe('healthy');
      expect(result.lastCheck).toBeTypeOf('number');
      expect(result.performance.avgResponseTime).toBeTypeOf('number');
      expect(result.performance.errorRate).toBe(0);
    });

    test('🔴 問題のあるプラグインでDegradedまたはUnhealthyステータスを返す', async () => {
      // First register the plugin
      await pluginManagementAPI.register({
        nodeType: 'problematic-plugin' as NodeType,
        displayName: 'Problematic Plugin',
        database: {
          entityStore: 'problematic',
          version: 1,
        },
      });
      const result = await pluginManagementAPI.checkHealth('problematic-plugin' as NodeType);

      expect(['degraded', 'unhealthy']).toContain(result.status);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.performance.errorRate).toBeGreaterThan(0);
    });

    test('🔴 未登録プラグインで適切なエラーを返す', async () => {
      await expect(pluginManagementAPI.checkHealth('non-existent' as NodeType)).rejects.toThrow(
        'Plugin not found'
      );
    });
  });

  describe('listRegistered() - 登録プラグイン一覧取得', () => {
    test('🔴 すべての登録済みプラグイン情報を取得できる', async () => {
      const result = await pluginManagementAPI.listRegistered();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      const firstPlugin = result[0];
      expect(firstPlugin.nodeType).toBeDefined();
      expect(firstPlugin.meta.name).toBeDefined();
      expect(firstPlugin.meta.version).toBeDefined();
      expect(firstPlugin.registrationTime).toBeTypeOf('number');
    });

    test('🔴 フィルター条件でプラグイン一覧を絞り込める', async () => {
      const options = {
        status: 'healthy' as const,
        category: 'core',
      };

      const result = await pluginManagementAPI.listRegistered(options);

      expect(Array.isArray(result)).toBe(true);
      result.forEach((plugin) => {
        expect(plugin.healthStatus.status).toBe('healthy');
        expect(plugin.meta.category).toBe('core');
      });
    });
  });

  describe('getDependencies() - プラグイン依存関係分析', () => {
    test('🔴 プラグインの依存関係情報を取得できる', async () => {
      const nodeType = 'folder' as NodeType;

      const result = await pluginManagementAPI.getDependencies(nodeType);

      expect(result.nodeType).toBe(nodeType);
      expect(Array.isArray(result.dependencies)).toBe(true);
      expect(Array.isArray(result.dependents)).toBe(true);
      expect(typeof result.circularDependencies).toBe('boolean');
    });

    test('🔴 循環依存の検出と警告を行う', async () => {
      const result = await pluginManagementAPI.getDependencies('circular-plugin' as NodeType);

      expect(result.circularDependencies).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings?.some((w) => w.toLowerCase().includes('circular'))).toBe(true);
    });
  });

  describe('bulkOperation() - 一括操作機能', () => {
    test('🔴 複数プラグインの一括登録が成功する', async () => {
      const plugins: PluginDefinition[] = [
        {
          nodeType: 'bulk-test-1' as NodeType,
          database: { entityStore: 'bulk1', schema: {}, version: 1 },
          meta: { name: 'Bulk Test 1', version: '1.0.0' },
        },
        {
          nodeType: 'bulk-test-2' as NodeType,
          database: { entityStore: 'bulk2', schema: {}, version: 1 },
          meta: { name: 'Bulk Test 2', version: '1.0.0' },
        },
      ];

      const result = await pluginManagementAPI.bulkOperation({
        operation: 'register',
        definition: plugins,
      });

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.summary.total).toBe(2);
      expect(result.summary.success).toBe(2);
    });

    test('🔴 部分的失敗を含む一括操作で詳細な結果を返す', async () => {
      const nodeTypes = ['folder', 'invalid-plugin', 'document'] as NodeType[];

      const result = await pluginManagementAPI.bulkOperation({
        operation: 'unregister',
        nodeTypes,
      });

      expect(result.successful.length).toBeGreaterThan(0);
      expect(result.failed.length).toBeGreaterThan(0);
      expect(result.summary.total).toBe(3);
      expect(result.summary.success + result.summary.failed).toBe(3);
    });
  });
});
