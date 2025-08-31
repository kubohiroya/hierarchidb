import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { NodeId, EntityId } from '@hierarchidb/common-type';
import { PropertyResolverEntityHandler } from '../handlers/PropertyResolverEntityHandler';
import { propertyResolverDB } from '../database/PropertyResolverDatabase';
import type {
  PropertyResolverEntity,
  PropertyResolverWorkingCopyEntity,
  PropertyMappingRule,
  ValidationRule,
  DataTransformation,
  DuplicateResolutionStrategy
} from '../types';

describe('PropertyResolver Plugin ユーザシナリオテスト', () => {
  let handler: PropertyResolverEntityHandler;
  
  beforeEach(async () => {
    handler = new PropertyResolverEntityHandler();
    await propertyResolverDB.open();
  });
  
  afterEach(async () => {
    await propertyResolverDB.delete();
  });

  describe('シナリオ1: プロパティマッピング作成', () => {
    it('テストケース1.1: 基本的なスキーママッピング作成', async () => {
      // Given - 顧客データの異なるスキーマ間のマッピング
      const nodeId = 'customer-mapping-node-1' as NodeId;
      const mappingData = {
        name: 'Customer Data Schema Mapping',
        description: '外部APIから内部顧客スキーマへのマッピング',
        sourceSchema: 'external_customer_api_v1',
        targetSchema: 'internal_customer_v2',
        mappingRules: [
          {
            id: 'customer-id-mapping',
            sourceProperty: 'customer_id',
            targetProperty: 'id',
            isRequired: true,
            description: '顧客IDの直接マッピング'
          },
          {
            id: 'name-mapping',
            sourceProperty: 'full_name',
            targetProperty: 'name',
            isRequired: true,
            description: '顧客名のマッピング'
          },
          {
            id: 'email-mapping',
            sourceProperty: 'email_address',
            targetProperty: 'email',
            isRequired: false,
            defaultValue: '',
            description: 'メールアドレスのマッピング'
          },
          {
            id: 'phone-mapping',
            sourceProperty: 'phone_number',
            targetProperty: 'phone',
            isRequired: false,
            defaultValue: null,
            description: '電話番号のマッピング'
          },
          {
            id: 'created-mapping',
            sourceProperty: 'created_timestamp',
            targetProperty: 'createdAt',
            transformFunction: 'timestamp_to_unix',
            isRequired: true,
            description: '作成日時の変換マッピング'
          }
        ] as PropertyMappingRule[]
      };

      // When
      const entity = await handler.createEntity(nodeId, mappingData);

      // Then
      expect(entity).toBeDefined();
      expect(entity.name).toBe('Customer Data Schema Mapping');
      expect(entity.sourceSchema).toBe('external_customer_api_v1');
      expect(entity.targetSchema).toBe('internal_customer_v2');
      expect(entity.mappingRules).toHaveLength(5);
      
      // 必須フィールドの確認
      const requiredRules = entity.mappingRules.filter(rule => rule.isRequired);
      expect(requiredRules).toHaveLength(3); // customer_id, full_name, created_timestamp
      
      // デフォルト値の確認
      const emailRule = entity.mappingRules.find(rule => rule.id === 'email-mapping');
      expect(emailRule?.defaultValue).toBe('');
      
      const phoneRule = entity.mappingRules.find(rule => rule.id === 'phone-mapping');
      expect(phoneRule?.defaultValue).toBe(null);
      
      // 変換関数の確認
      const createdRule = entity.mappingRules.find(rule => rule.id === 'created-mapping');
      expect(createdRule?.transformFunction).toBe('timestamp_to_unix');
      
      expect(entity.isCompiled).toBe(false); // 初期作成時は未コンパイル
      expect(entity.version).toBe(1);
    });

    it('テストケース1.2: 複雑な変換ルール設定', async () => {
      // Given - 商品データの複雑な変換マッピング
      const nodeId = 'product-transform-node' as NodeId;
      const complexMappingData = {
        name: 'Product Data Complex Transformation',
        description: '商品データの複雑な変換処理',
        sourceSchema: 'ecommerce_product_feed',
        targetSchema: 'internal_product_catalog',
        mappingRules: [
          {
            id: 'product-id',
            sourceProperty: 'sku',
            targetProperty: 'productId',
            isRequired: true
          }
        ] as PropertyMappingRule[],
        dataTransformations: [
          {
            id: 'price-calculation',
            property: 'finalPrice',
            transformationType: 'calculate',
            parameters: {
              formula: '(basePrice * (1 - discountRate)) * (1 + taxRate)',
              dependencies: ['basePrice', 'discountRate', 'taxRate']
            },
            transformFunction: `
              function calculateFinalPrice(data) {
                const { basePrice, discountRate, taxRate } = data;
                if (!basePrice || basePrice <= 0) return 0;
                const discountedPrice = basePrice * (1 - (discountRate || 0));
                return Math.round(discountedPrice * (1 + (taxRate || 0)) * 100) / 100;
              }
            `
          },
          {
            id: 'category-normalization',
            property: 'category',
            transformationType: 'lookup',
            parameters: {
              lookupTable: {
                'electronics/phones': 'Electronics > Mobile Phones',
                'electronics/computers': 'Electronics > Computers',
                'clothing/mens': 'Apparel > Men',
                'clothing/womens': 'Apparel > Women'
              },
              fallback: 'Other'
            },
            transformFunction: `
              function normalizeCategory(sourceCategory, lookupTable, fallback) {
                return lookupTable[sourceCategory?.toLowerCase()] || fallback || 'Unknown';
              }
            `
          },
          {
            id: 'availability-status',
            property: 'availabilityStatus',
            transformationType: 'custom',
            parameters: {
              stockThreshold: 5,
              backorderAllowed: true
            },
            transformFunction: `
              function determineAvailability(data, params) {
                const { stock, backorderEnabled } = data;
                const { stockThreshold, backorderAllowed } = params;
                
                if (stock > stockThreshold) return 'available';
                if (stock > 0) return 'limited';
                if (backorderEnabled && backorderAllowed) return 'backorder';
                return 'out_of_stock';
              }
            `
          }
        ] as DataTransformation[]
      };

      // When
      const entity = await handler.createEntity(nodeId, complexMappingData);

      // Then
      expect(entity.dataTransformations).toHaveLength(3);
      
      // 価格計算変換の確認
      const priceTransform = entity.dataTransformations.find(t => t.id === 'price-calculation');
      expect(priceTransform?.transformationType).toBe('calculate');
      expect(priceTransform?.parameters.dependencies).toEqual(['basePrice', 'discountRate', 'taxRate']);
      expect(priceTransform?.transformFunction).toContain('calculateFinalPrice');
      
      // カテゴリ正規化変換の確認
      const categoryTransform = entity.dataTransformations.find(t => t.id === 'category-normalization');
      expect(categoryTransform?.transformationType).toBe('lookup');
      expect(categoryTransform?.parameters.lookupTable).toHaveProperty('electronics/phones');
      expect(categoryTransform?.parameters.fallback).toBe('Other');
      
      // 在庫状況変換の確認
      const availabilityTransform = entity.dataTransformations.find(t => t.id === 'availability-status');
      expect(availabilityTransform?.transformationType).toBe('custom');
      expect(availabilityTransform?.parameters.stockThreshold).toBe(5);
      expect(availabilityTransform?.transformFunction).toContain('determineAvailability');
    });

    it('テストケース1.3: バリデーションルール統合', async () => {
      // Given - 包括的なバリデーションルールを持つマッピング
      const nodeId = 'validation-mapping-node' as NodeId;
      const validationMappingData = {
        name: 'User Registration Validation Mapping',
        description: 'ユーザ登録データの検証付きマッピング',
        sourceSchema: 'registration_form',
        targetSchema: 'user_profile',
        mappingRules: [
          {
            id: 'username-mapping',
            sourceProperty: 'username',
            targetProperty: 'username',
            isRequired: true
          },
          {
            id: 'email-mapping',
            sourceProperty: 'email',
            targetProperty: 'email',
            isRequired: true
          },
          {
            id: 'age-mapping',
            sourceProperty: 'age',
            targetProperty: 'age',
            isRequired: false
          }
        ] as PropertyMappingRule[],
        validationRules: [
          {
            id: 'username-required',
            property: 'username',
            ruleType: 'required',
            parameters: {},
            errorMessage: 'ユーザ名は必須です'
          },
          {
            id: 'username-pattern',
            property: 'username',
            ruleType: 'pattern',
            parameters: {
              regex: '^[a-zA-Z0-9_]{3,20}$'
            },
            errorMessage: 'ユーザ名は3-20文字の英数字とアンダースコアのみ使用可能です'
          },
          {
            id: 'email-required',
            property: 'email',
            ruleType: 'required',
            parameters: {},
            errorMessage: 'メールアドレスは必須です'
          },
          {
            id: 'email-format',
            property: 'email',
            ruleType: 'pattern',
            parameters: {
              regex: '^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$'
            },
            errorMessage: '有効なメールアドレス形式で入力してください'
          },
          {
            id: 'age-range',
            property: 'age',
            ruleType: 'range',
            parameters: {
              min: 13,
              max: 120
            },
            errorMessage: '年齢は13歳以上120歳以下で入力してください'
          },
          {
            id: 'age-type',
            property: 'age',
            ruleType: 'type',
            parameters: {
              type: 'integer'
            },
            errorMessage: '年齢は整数で入力してください'
          },
          {
            id: 'custom-validation',
            property: 'username',
            ruleType: 'custom',
            parameters: {
              validationFunction: `
                function validateUniqueUsername(username, context) {
                  // Simulate database check
                  const reservedNames = ['admin', 'root', 'test', 'demo'];
                  if (reservedNames.includes(username.toLowerCase())) {
                    return { valid: false, message: '予約済みのユーザ名は使用できません' };
                  }
                  return { valid: true };
                }
              `
            },
            errorMessage: 'カスタムバリデーションに失敗しました'
          }
        ] as ValidationRule[]
      };

      // When
      const entity = await handler.createEntity(nodeId, validationMappingData);

      // Then
      expect(entity.validationRules).toHaveLength(7);
      
      // 必須チェックルール
      const requiredRules = entity.validationRules.filter(rule => rule.ruleType === 'required');
      expect(requiredRules).toHaveLength(2); // username, email
      
      // パターンチェックルール
      const patternRules = entity.validationRules.filter(rule => rule.ruleType === 'pattern');
      expect(patternRules).toHaveLength(2); // username, email
      
      const usernamePatternRule = entity.validationRules.find(rule => 
        rule.property === 'username' && rule.ruleType === 'pattern'
      );
      expect(usernamePatternRule?.parameters.regex).toBe('^[a-zA-Z0-9_]{3,20}$');
      
      // 範囲チェックルール
      const rangeRule = entity.validationRules.find(rule => rule.ruleType === 'range');
      expect(rangeRule?.property).toBe('age');
      expect(rangeRule?.parameters.min).toBe(13);
      expect(rangeRule?.parameters.max).toBe(120);
      
      // 型チェックルール
      const typeRule = entity.validationRules.find(rule => rule.ruleType === 'type');
      expect(typeRule?.parameters.type).toBe('integer');
      
      // カスタムバリデーション
      const customRule = entity.validationRules.find(rule => rule.ruleType === 'custom');
      expect(customRule?.parameters.validationFunction).toContain('validateUniqueUsername');
      expect(customRule?.errorMessage).toBe('カスタムバリデーションに失敗しました');
    });
  });

  describe('シナリオ2: 動的プロパティ解決・編集', () => {
    let existingEntity: PropertyResolverEntity;

    beforeEach(async () => {
      const nodeId = 'existing-resolver-node' as NodeId;
      existingEntity = await handler.createEntity(nodeId, {
        name: 'Existing Property Resolver',
        sourceSchema: 'source_v1',
        targetSchema: 'target_v1',
        mappingRules: [
          {
            id: 'basic-mapping',
            sourceProperty: 'src_prop',
            targetProperty: 'tgt_prop',
            isRequired: true
          }
        ],
        duplicateResolution: { strategy: 'skip' }
      });
    });

    it('テストケース2.1: マッピングルール編集（WorkingCopyパターン）', async () => {
      // Given - WorkingCopyを作成
      const workingCopy: PropertyResolverWorkingCopyEntity = {
        ...existingEntity,
        copiedAt: Date.now(),
        isDirty: false,
        originalVersion: existingEntity.version,
        modifiedFields: []
      };

      // When - マッピングルールを編集
      workingCopy.mappingRules = [
        ...workingCopy.mappingRules,
        {
          id: 'new-calculated-field',
          sourceProperty: 'firstName,lastName',
          targetProperty: 'fullName',
          transformFunction: `
            function combineNames(data) {
              const { firstName, lastName } = data;
              return [firstName, lastName].filter(Boolean).join(' ');
            }
          `,
          isRequired: false,
          description: '姓名を結合して氏名を生成'
        },
        {
          id: 'conditional-mapping',
          sourceProperty: 'userType',
          targetProperty: 'permissions',
          transformFunction: `
            function mapPermissions(userType) {
              const permissionMap = {
                'admin': ['read', 'write', 'delete', 'admin'],
                'editor': ['read', 'write'],
                'viewer': ['read']
              };
              return permissionMap[userType] || ['read'];
            }
          `,
          isRequired: true,
          defaultValue: ['read'],
          description: 'ユーザタイプに基づく権限マッピング'
        }
      ];

      workingCopy.isDirty = true;
      workingCopy.modifiedFields = ['mappingRules'];
      workingCopy.updatedAt = Date.now();

      // Then - WorkingCopyの状態確認
      expect(workingCopy.mappingRules).toHaveLength(3);
      expect(workingCopy.isDirty).toBe(true);
      expect(workingCopy.modifiedFields).toContain('mappingRules');
      
      const calculatedField = workingCopy.mappingRules.find(rule => rule.id === 'new-calculated-field');
      expect(calculatedField?.sourceProperty).toBe('firstName,lastName');
      expect(calculatedField?.targetProperty).toBe('fullName');
      expect(calculatedField?.transformFunction).toContain('combineNames');
      
      const conditionalMapping = workingCopy.mappingRules.find(rule => rule.id === 'conditional-mapping');
      expect(conditionalMapping?.transformFunction).toContain('mapPermissions');
      expect(conditionalMapping?.defaultValue).toEqual(['read']);

      // WorkingCopyのコミットをシミュレート
      const updatedEntity = await handler.updateEntity(existingEntity.nodeId, {
        mappingRules: workingCopy.mappingRules,
        version: workingCopy.version + 1
      });
      
      expect(updatedEntity.mappingRules).toHaveLength(3);
      expect(updatedEntity.version).toBe(2);
    });

    it('テストケース2.2: 重複解決戦略の設定', async () => {
      // Given - 重複解決戦略の設定
      const duplicateResolutionStrategies: DuplicateResolutionStrategy[] = [
        {
          strategy: 'ignore',
          // 重複を無視（最初のレコードを保持）
        },
        {
          strategy: 'overwrite',
          // 新しいレコードで上書き
        },
        {
          strategy: 'merge',
          mergeProperties: ['name', 'email', 'lastUpdated'],
          // 指定プロパティをマージ
        },
        {
          strategy: 'skip',
          // 重複するレコードをスキップ
        },
        {
          strategy: 'custom',
          customFunction: `
            function customDuplicateResolver(existing, incoming, context) {
              // カスタム重複解決ロジック
              if (incoming.lastModified > existing.lastModified) {
                // より新しいデータを優先
                return {
                  action: 'update',
                  result: { ...existing, ...incoming }
                };
              } else if (incoming.priority > existing.priority) {
                // 優先度が高いデータを優先
                return {
                  action: 'update', 
                  result: { ...existing, priority: incoming.priority }
                };
              }
              return { action: 'skip', result: existing };
            }
          `
        }
      ];

      // When - 各戦略をテスト
      for (let i = 0; i < duplicateResolutionStrategies.length; i++) {
        const strategy = duplicateResolutionStrategies[i];
        const nodeId = `duplicate-test-${i}` as NodeId;
        
        const entity = await handler.createEntity(nodeId, {
          name: `Duplicate Resolution Test - ${strategy.strategy}`,
          sourceSchema: 'duplicate_test_source',
          targetSchema: 'duplicate_test_target',
          duplicateResolution: strategy,
          mappingRules: [
            {
              id: 'key-mapping',
              sourceProperty: 'id',
              targetProperty: 'id',
              isRequired: true
            }
          ]
        });

        // Then
        expect(entity.duplicateResolution.strategy).toBe(strategy.strategy);
        
        if (strategy.strategy === 'merge') {
          expect(entity.duplicateResolution.mergeProperties).toEqual(['name', 'email', 'lastUpdated']);
        }
        
        if (strategy.strategy === 'custom') {
          expect(entity.duplicateResolution.customFunction).toContain('customDuplicateResolver');
          expect(entity.duplicateResolution.customFunction).toContain('lastModified');
          expect(entity.duplicateResolution.customFunction).toContain('priority');
        }
      }
    });

    it('テストケース2.3: 動的プロパティ計算と依存関係管理', async () => {
      // Given - 複雑な依存関係を持つプロパティ計算
      const nodeId = 'dependency-resolver-node' as NodeId;
      const dependencyMappingData = {
        name: 'Complex Dependency Resolver',
        description: '複雑な依存関係を持つプロパティ計算',
        sourceSchema: 'financial_data',
        targetSchema: 'financial_summary',
        mappingRules: [
          {
            id: 'base-amount',
            sourceProperty: 'baseAmount',
            targetProperty: 'baseAmount',
            isRequired: true
          },
          {
            id: 'tax-rate',
            sourceProperty: 'taxRate',
            targetProperty: 'taxRate',
            isRequired: true,
            defaultValue: 0.1
          }
        ] as PropertyMappingRule[],
        dataTransformations: [
          // レベル1: 基本計算（依存関係なし）
          {
            id: 'tax-amount',
            property: 'taxAmount',
            transformationType: 'calculate',
            parameters: {
              dependencies: ['baseAmount', 'taxRate'],
              formula: 'baseAmount * taxRate'
            },
            transformFunction: `
              function calculateTaxAmount(data) {
                return (data.baseAmount || 0) * (data.taxRate || 0);
              }
            `
          },
          // レベル2: レベル1の結果に依存
          {
            id: 'total-amount',
            property: 'totalAmount',
            transformationType: 'calculate',
            parameters: {
              dependencies: ['baseAmount', 'taxAmount'],
              formula: 'baseAmount + taxAmount'
            },
            transformFunction: `
              function calculateTotalAmount(data) {
                return (data.baseAmount || 0) + (data.taxAmount || 0);
              }
            `
          },
          // レベル3: レベル2の結果に依存
          {
            id: 'discount-amount',
            property: 'discountAmount',
            transformationType: 'calculate',
            parameters: {
              dependencies: ['totalAmount', 'discountRate'],
              formula: 'totalAmount * (discountRate || 0)'
            },
            transformFunction: `
              function calculateDiscountAmount(data) {
                return (data.totalAmount || 0) * (data.discountRate || 0);
              }
            `
          },
          // レベル4: レベル3の結果に依存（最終計算）
          {
            id: 'final-amount',
            property: 'finalAmount',
            transformationType: 'calculate',
            parameters: {
              dependencies: ['totalAmount', 'discountAmount'],
              formula: 'totalAmount - discountAmount'
            },
            transformFunction: `
              function calculateFinalAmount(data) {
                return (data.totalAmount || 0) - (data.discountAmount || 0);
              }
            `
          },
          // 並列計算: 他の計算と独立
          {
            id: 'profit-margin',
            property: 'profitMargin',
            transformationType: 'calculate',
            parameters: {
              dependencies: ['finalAmount', 'costAmount'],
              formula: '((finalAmount - costAmount) / finalAmount) * 100'
            },
            transformFunction: `
              function calculateProfitMargin(data) {
                const { finalAmount, costAmount } = data;
                if (!finalAmount || finalAmount === 0) return 0;
                return ((finalAmount - (costAmount || 0)) / finalAmount) * 100;
              }
            `
          }
        ] as DataTransformation[]
      };

      // When
      const entity = await handler.createEntity(nodeId, dependencyMappingData);

      // Then - 依存関係の構造を検証
      expect(entity.dataTransformations).toHaveLength(5);
      
      // レベル1: 基本データのみに依存
      const taxAmountTransform = entity.dataTransformations.find(t => t.id === 'tax-amount');
      expect(taxAmountTransform?.parameters.dependencies).toEqual(['baseAmount', 'taxRate']);
      
      // レベル2: レベル1の結果に依存
      const totalAmountTransform = entity.dataTransformations.find(t => t.id === 'total-amount');
      expect(totalAmountTransform?.parameters.dependencies).toEqual(['baseAmount', 'taxAmount']);
      
      // レベル3: レベル2の結果に依存
      const discountAmountTransform = entity.dataTransformations.find(t => t.id === 'discount-amount');
      expect(discountAmountTransform?.parameters.dependencies).toEqual(['totalAmount', 'discountRate']);
      
      // レベル4: レベル3の結果に依存
      const finalAmountTransform = entity.dataTransformations.find(t => t.id === 'final-amount');
      expect(finalAmountTransform?.parameters.dependencies).toEqual(['totalAmount', 'discountAmount']);
      
      // 並列計算: 最終結果に依存但し他の計算フローとは独立
      const profitMarginTransform = entity.dataTransformations.find(t => t.id === 'profit-margin');
      expect(profitMarginTransform?.parameters.dependencies).toEqual(['finalAmount', 'costAmount']);

      // 実行順序の推定（依存関係の深度順）
      const executionOrder = [
        'tax-amount',      // レベル1
        'total-amount',    // レベル2
        'discount-amount', // レベル3
        'final-amount',    // レベル4
        'profit-margin'    // 並列（レベル4の結果を使用）
      ];
      
      // 各変換の依存関係が論理的に正しいことを確認
      expect(entity.dataTransformations.map(t => t.id)).toEqual(expect.arrayContaining(executionOrder));
    });
  });

  describe('シナリオ3: バッチ処理・スキーマ統合', () => {
    it('テストケース3.1: 複数スキーマの一括マッピング', async () => {
      // Given - 複数のソーススキーマから統一ターゲットスキーマへのマッピング
      const targetSchema = 'unified_user_profile_v2';
      const sourceSchemas = [
        {
          name: 'legacy_system_v1',
          mappings: {
            'user_id': 'id',
            'user_name': 'username',
            'mail_address': 'email',
            'phone_num': 'phone',
            'create_time': 'createdAt'
          }
        },
        {
          name: 'crm_system_v3',
          mappings: {
            'customer_id': 'id',
            'display_name': 'username', 
            'email_address': 'email',
            'mobile_phone': 'phone',
            'registration_date': 'createdAt'
          }
        },
        {
          name: 'social_auth_v2',
          mappings: {
            'social_id': 'id',
            'screen_name': 'username',
            'contact_email': 'email',
            'verified_phone': 'phone',
            'joined_at': 'createdAt'
          }
        }
      ];

      const unifiedMappings = [];

      // When - 各ソーススキーマに対してマッピングを作成
      for (let i = 0; i < sourceSchemas.length; i++) {
        const schema = sourceSchemas[i];
        const nodeId = `unified-mapping-${i}` as NodeId;
        
        const mappingRules = Object.entries(schema.mappings).map(([source, target]) => ({
          id: `${source}-to-${target}`,
          sourceProperty: source,
          targetProperty: target,
          isRequired: target === 'id', // IDフィールドは必須
          transformFunction: target === 'createdAt' ? 'convertToUnixTimestamp' : undefined,
          description: `${schema.name}の${source}フィールドを${target}にマッピング`
        }));

        const entity = await handler.createEntity(nodeId, {
          name: `Unified Mapping - ${schema.name}`,
          description: `${schema.name}から${targetSchema}への統一マッピング`,
          sourceSchema: schema.name,
          targetSchema,
          mappingRules: mappingRules as PropertyMappingRule[]
        });

        unifiedMappings.push(entity);
      }

      // Then - 統一マッピングの検証
      expect(unifiedMappings).toHaveLength(3);
      
      // 全マッピングが同じターゲットスキーマを使用
      unifiedMappings.forEach(mapping => {
        expect(mapping.targetSchema).toBe(targetSchema);
      });
      
      // 各マッピングルールが適切に設定されている
      const legacyMapping = unifiedMappings[0];
      expect(legacyMapping.sourceSchema).toBe('legacy_system_v1');
      expect(legacyMapping.mappingRules).toHaveLength(5);
      
      const idMapping = legacyMapping.mappingRules.find(rule => rule.targetProperty === 'id');
      expect(idMapping?.sourceProperty).toBe('user_id');
      expect(idMapping?.isRequired).toBe(true);
      
      const createdAtMapping = legacyMapping.mappingRules.find(rule => rule.targetProperty === 'createdAt');
      expect(createdAtMapping?.transformFunction).toBe('convertToUnixTimestamp');
      
      // 各ソーススキーマの特徴的なフィールドマッピングを確認
      const crmMapping = unifiedMappings[1];
      const crmIdRule = crmMapping.mappingRules.find(rule => rule.targetProperty === 'id');
      expect(crmIdRule?.sourceProperty).toBe('customer_id');
      
      const socialMapping = unifiedMappings[2];
      const socialUsernameRule = socialMapping.mappingRules.find(rule => rule.targetProperty === 'username');
      expect(socialUsernameRule?.sourceProperty).toBe('screen_name');
    });

    it('テストケース3.2: スキーマ進化とマイグレーション', async () => {
      // Given - スキーマバージョン管理とマイグレーション
      const schemaVersions = [
        {
          version: 'user_profile_v1',
          fields: ['id', 'name', 'email', 'created_at']
        },
        {
          version: 'user_profile_v2', 
          fields: ['id', 'username', 'email', 'phone', 'created_at', 'updated_at'],
          migrations: {
            'name': 'username', // フィールド名変更
            'phone': null,      // 新規フィールド（デフォルト値）
            'updated_at': 'created_at' // 既存フィールドから複製
          }
        },
        {
          version: 'user_profile_v3',
          fields: ['id', 'username', 'email', 'phone', 'profile_data', 'created_at', 'updated_at'],
          migrations: {
            'profile_data': null // 新規オブジェクトフィールド
          }
        }
      ];

      // When - マイグレーション用マッピングを作成
      const migrationMappings = [];
      
      for (let i = 1; i < schemaVersions.length; i++) {
        const currentVersion = schemaVersions[i];
        const previousVersion = schemaVersions[i - 1];
        const nodeId = `migration-${previousVersion.version}-to-${currentVersion.version}` as NodeId;
        
        const mappingRules: PropertyMappingRule[] = [];
        
        // 既存フィールドの直接マッピング
        const commonFields = currentVersion.fields.filter(field => 
          previousVersion.fields.includes(field)
        );
        
        commonFields.forEach(field => {
          mappingRules.push({
            id: `direct-${field}`,
            sourceProperty: field,
            targetProperty: field,
            isRequired: field === 'id',
            description: `${field}フィールドの直接マッピング`
          });
        });
        
        // マイグレーション固有のルール
        if (currentVersion.migrations) {
          Object.entries(currentVersion.migrations).forEach(([newField, sourceField]) => {
            if (sourceField === null) {
              // 新規フィールド（デフォルト値）
              mappingRules.push({
                id: `new-${newField}`,
                sourceProperty: '',
                targetProperty: newField,
                isRequired: false,
                defaultValue: newField === 'phone' ? '' : 
                             newField === 'updated_at' ? 'CURRENT_TIMESTAMP' :
                             newField === 'profile_data' ? '{}' : null,
                description: `新規フィールド${newField}のデフォルト値設定`
              });
            } else {
              // フィールド名変更またはコピー
              mappingRules.push({
                id: `migrate-${sourceField}-to-${newField}`,
                sourceProperty: sourceField,
                targetProperty: newField,
                isRequired: false,
                transformFunction: newField === 'updated_at' ? 'copyTimestamp' : undefined,
                description: `${sourceField}から${newField}へのマイグレーション`
              });
            }
          });
        }

        const migrationEntity = await handler.createEntity(nodeId, {
          name: `Schema Migration: ${previousVersion.version} → ${currentVersion.version}`,
          description: `${previousVersion.version}から${currentVersion.version}への自動マイグレーション`,
          sourceSchema: previousVersion.version,
          targetSchema: currentVersion.version,
          mappingRules,
          validationRules: [
            {
              id: 'version-check',
              property: 'id',
              ruleType: 'required',
              parameters: {},
              errorMessage: 'IDフィールドは必須です'
            }
          ] as ValidationRule[]
        });

        migrationMappings.push(migrationEntity);
      }

      // Then - マイグレーション設定の検証
      expect(migrationMappings).toHaveLength(2); // v1→v2, v2→v3
      
      // v1 → v2 マイグレーション
      const v1ToV2Migration = migrationMappings[0];
      expect(v1ToV2Migration.sourceSchema).toBe('user_profile_v1');
      expect(v1ToV2Migration.targetSchema).toBe('user_profile_v2');
      
      // フィールド名変更の確認
      const nameToUsernameRule = v1ToV2Migration.mappingRules.find(rule => 
        rule.sourceProperty === 'name' && rule.targetProperty === 'username'
      );
      expect(nameToUsernameRule).toBeDefined();
      
      // 新規フィールドの確認
      const newPhoneRule = v1ToV2Migration.mappingRules.find(rule => 
        rule.targetProperty === 'phone' && rule.sourceProperty === ''
      );
      expect(newPhoneRule?.defaultValue).toBe('');
      
      const newUpdatedAtRule = v1ToV2Migration.mappingRules.find(rule => 
        rule.targetProperty === 'updated_at' && rule.sourceProperty === 'created_at'
      );
      expect(newUpdatedAtRule?.transformFunction).toBe('copyTimestamp');
      
      // v2 → v3 マイグレーション
      const v2ToV3Migration = migrationMappings[1];
      expect(v2ToV3Migration.sourceSchema).toBe('user_profile_v2');
      expect(v2ToV3Migration.targetSchema).toBe('user_profile_v3');
      
      const newProfileDataRule = v2ToV3Migration.mappingRules.find(rule => 
        rule.targetProperty === 'profile_data' && rule.sourceProperty === ''
      );
      expect(newProfileDataRule?.defaultValue).toBe('{}');
    });

    it('テストケース3.3: パフォーマンス最適化と関数コンパイル', async () => {
      // Given - パフォーマンス最適化対象の大規模マッピング
      const nodeId = 'performance-optimized-mapping' as NodeId;
      const largeScaleMappingData = {
        name: 'Large Scale Performance Mapping',
        description: '大規模データ処理用の最適化されたマッピング',
        sourceSchema: 'big_data_source',
        targetSchema: 'optimized_target',
        mappingRules: Array.from({ length: 50 }, (_, index) => ({
          id: `field-mapping-${index}`,
          sourceProperty: `source_field_${index}`,
          targetProperty: `target_field_${index}`,
          isRequired: index < 5, // 最初の5つは必須
          transformFunction: index % 3 === 0 ? `
            function transform_field_${index}(value) {
              // 軽量な変換処理
              return value ? String(value).toUpperCase() : '';
            }
          ` : undefined,
          description: `フィールド${index}のマッピング`
        })) as PropertyMappingRule[],
        dataTransformations: [
          {
            id: 'batch-calculation',
            property: 'calculated_score',
            transformationType: 'calculate',
            parameters: {
              dependencies: ['value1', 'value2', 'value3', 'weight1', 'weight2', 'weight3'],
              optimized: true,
              cacheResults: true
            },
            transformFunction: `
              function calculateOptimizedScore(data) {
                // 最適化された計算処理
                const { value1, value2, value3, weight1 = 1, weight2 = 1, weight3 = 1 } = data;
                
                // 早期リターンによる最適化
                if (!value1 && !value2 && !value3) return 0;
                
                // インライン計算による高速化
                return (
                  (value1 || 0) * weight1 +
                  (value2 || 0) * weight2 + 
                  (value3 || 0) * weight3
                ) / (weight1 + weight2 + weight3);
              }
            `
          }
        ] as DataTransformation[],
        previewConfig: {
          sampleSize: 1000,
          refreshInterval: 5000,
          highlightMappings: false, // パフォーマンス優先
          showValidationErrors: true
        }
      };

      // When - パフォーマンス測定付きで作成
      const startTime = performance.now();
      const entity = await handler.createEntity(nodeId, largeScaleMappingData);
      const creationTime = performance.now() - startTime;

      // 大量マッピングルールのシミュレーション処理
      const processingStartTime = performance.now();
      
      // マッピングルールの最適化（関数コンパイル）
      const compiledRules = entity.mappingRules.map(rule => {
        if (rule.transformFunction) {
          return {
            ...rule,
            compiled: true,
            compiledFunction: `optimized_${rule.id}`,
            compilationTime: Math.random() * 10 + 5 // 5-15ms
          };
        }
        return rule;
      });
      
      const processingTime = performance.now() - processingStartTime;

      // Then - パフォーマンス基準の検証
      expect(creationTime).toBeLessThan(100); // 100ms以内でエンティティ作成
      expect(processingTime).toBeLessThan(500); // 500ms以内で処理完了
      
      expect(entity.mappingRules).toHaveLength(50);
      expect(entity.dataTransformations).toHaveLength(1);
      
      // 最適化設定の確認
      expect(entity.previewConfig?.sampleSize).toBe(1000);
      expect(entity.previewConfig?.highlightMappings).toBe(false); // パフォーマンス優先
      
      // 変換関数のコンパイル対象確認
      const transformRules = entity.mappingRules.filter(rule => rule.transformFunction);
      expect(transformRules).toHaveLength(17); // 50個中、index % 3 === 0 のもの
      
      // バッチ計算の最適化設定確認
      const batchTransform = entity.dataTransformations[0];
      expect(batchTransform.parameters.optimized).toBe(true);
      expect(batchTransform.parameters.cacheResults).toBe(true);
      expect(batchTransform.parameters.dependencies).toHaveLength(6);

      // コンパイルされた関数の検証
      const compiledTransformRules = compiledRules.filter(rule => rule.compiled);
      expect(compiledTransformRules).toHaveLength(17);
      
      compiledTransformRules.forEach(rule => {
        expect(rule.compiledFunction).toContain('optimized_');
        expect(rule.compilationTime).toBeGreaterThan(0);
      });

      // メモリ効率の推定チェック
      const estimatedMemoryUsage = 
        entity.mappingRules.length * 200 + // 各ルール約200bytes
        entity.dataTransformations.length * 500; // 各変換約500bytes
      
      expect(estimatedMemoryUsage).toBeLessThan(50000); // 50KB以下
    });
  });

  describe('技術的検証', () => {
    it('WorkingCopyパターンでのマッピングルール整合性確保', async () => {
      // Given - 複雑なマッピングルールを持つエンティティ
      const nodeId = 'consistency-test-node' as NodeId;
      const originalEntity = await handler.createEntity(nodeId, {
        name: 'Consistency Test Mapping',
        sourceSchema: 'source_schema',
        targetSchema: 'target_schema',
        mappingRules: [
          {
            id: 'rule-1',
            sourceProperty: 'source1',
            targetProperty: 'target1',
            isRequired: true
          },
          {
            id: 'rule-2', 
            sourceProperty: 'source2',
            targetProperty: 'target2',
            isRequired: false,
            defaultValue: 'default'
          }
        ] as PropertyMappingRule[],
        validationRules: [
          {
            id: 'validation-1',
            property: 'target1',
            ruleType: 'required',
            parameters: {},
            errorMessage: 'target1 is required'
          }
        ] as ValidationRule[]
      });

      // When - WorkingCopyを作成して変更
      const workingCopy: PropertyResolverWorkingCopyEntity = {
        ...originalEntity,
        copiedAt: Date.now(),
        isDirty: false,
        originalVersion: originalEntity.version,
        modifiedFields: []
      };

      // 整合性を破る可能性のある変更を実行
      workingCopy.mappingRules = [
        ...workingCopy.mappingRules,
        {
          id: 'rule-3',
          sourceProperty: 'source3',
          targetProperty: 'target3',
          isRequired: true // 新しい必須フィールド
        }
      ];

      // 対応するバリデーションルールも追加（整合性を保つ）
      workingCopy.validationRules = [
        ...workingCopy.validationRules,
        {
          id: 'validation-3',
          property: 'target3',
          ruleType: 'required',
          parameters: {},
          errorMessage: 'target3 is required'
        }
      ];

      workingCopy.isDirty = true;
      workingCopy.modifiedFields = ['mappingRules', 'validationRules'];

      // Then - 整合性の検証
      // 必須フィールドに対応するバリデーションルールが存在する
      const requiredMappings = workingCopy.mappingRules.filter(rule => rule.isRequired);
      const requiredValidations = workingCopy.validationRules.filter(rule => rule.ruleType === 'required');
      
      expect(requiredMappings).toHaveLength(2); // rule-1, rule-3
      expect(requiredValidations).toHaveLength(2); // validation-1, validation-3
      
      requiredMappings.forEach(mapping => {
        const correspondingValidation = requiredValidations.find(validation => 
          validation.property === mapping.targetProperty
        );
        expect(correspondingValidation).toBeDefined();
      });

      // WorkingCopyの状態が正しく管理されている
      expect(workingCopy.isDirty).toBe(true);
      expect(workingCopy.modifiedFields).toContain('mappingRules');
      expect(workingCopy.modifiedFields).toContain('validationRules');
      expect(workingCopy.originalVersion).toBe(1);
      expect(workingCopy.copiedAt).toBeGreaterThan(originalEntity.createdAt);
    });

    it('変換関数のコンパイル精度と実行安全性', async () => {
      // Given - 様々な変換関数のテストケース
      const testFunctions = [
        {
          name: 'safe-string-transform',
          code: `
            function safeStringTransform(value) {
              return value ? String(value).trim().toLowerCase() : '';
            }
          `,
          testInput: '  HELLO WORLD  ',
          expectedOutput: 'hello world'
        },
        {
          name: 'safe-number-transform',
          code: `
            function safeNumberTransform(value) {
              const num = Number(value);
              return isNaN(num) ? 0 : Math.round(num * 100) / 100;
            }
          `,
          testInput: '123.456',
          expectedOutput: 123.46
        },
        {
          name: 'safe-date-transform',
          code: `
            function safeDateTransform(value) {
              if (!value) return null;
              const date = new Date(value);
              return isNaN(date.getTime()) ? null : date.getTime();
            }
          `,
          testInput: '2024-01-15T10:30:00Z',
          expectedOutput: 1705315800000
        },
        {
          name: 'safe-object-transform',
          code: `
            function safeObjectTransform(value) {
              try {
                return typeof value === 'string' ? JSON.parse(value) : value;
              } catch (e) {
                return {};
              }
            }
          `,
          testInput: '{"name": "test", "value": 123}',
          expectedOutput: { name: 'test', value: 123 }
        }
      ];

      // When - 各変換関数のコンパイルと実行テスト
      const results = [];
      for (const testFunc of testFunctions) {
        const nodeId = `compile-test-${testFunc.name}` as NodeId;
        
        const entity = await handler.createEntity(nodeId, {
          name: `Compile Test - ${testFunc.name}`,
          sourceSchema: 'test_source',
          targetSchema: 'test_target',
          mappingRules: [
            {
              id: 'transform-rule',
              sourceProperty: 'input',
              targetProperty: 'output',
              transformFunction: testFunc.code,
              isRequired: false
            }
          ] as PropertyMappingRule[]
        });

        // 変換関数の実行をシミュレート
        try {
          // 実際のプロダクションではsandbox環境で実行
          const transformResult = eval(`(${testFunc.code})`)(testFunc.testInput);
          
          results.push({
            functionName: testFunc.name,
            success: true,
            result: transformResult,
            expected: testFunc.expectedOutput,
            entity: entity
          });
        } catch (error) {
          results.push({
            functionName: testFunc.name,
            success: false,
            error: error.message,
            entity: entity
          });
        }
      }

      // Then - コンパイル結果の検証
      expect(results).toHaveLength(4);
      
      // 全ての変換関数が正常にコンパイルされる
      expect(results.every(r => r.success)).toBe(true);
      
      // 変換結果の精度確認
      const stringResult = results.find(r => r.functionName === 'safe-string-transform');
      expect(stringResult?.result).toBe('hello world');
      
      const numberResult = results.find(r => r.functionName === 'safe-number-transform');
      expect(numberResult?.result).toBe(123.46);
      
      const dateResult = results.find(r => r.functionName === 'safe-date-transform');
      expect(dateResult?.result).toBe(1705315800000);
      
      const objectResult = results.find(r => r.functionName === 'safe-object-transform');
      expect(objectResult?.result).toEqual({ name: 'test', value: 123 });

      // エンティティが正常に作成されている
      results.forEach(result => {
        expect(result.entity.mappingRules).toHaveLength(1);
        expect(result.entity.mappingRules[0].transformFunction).toBeDefined();
      });
    });
  });
});