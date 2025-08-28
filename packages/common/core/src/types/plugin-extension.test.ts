/**
 * @file plugin-extension.test.ts
 * @description プラグイン拡張システムの型定義テスト
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { NodeId } from '../index';
import type {
  ExtendingNodeTypeDefinition,
  BaseNodeDefinition,
  DialogStepDefinition,
  ExtendedFieldDefinition,
  ExtensionMetadata,
  BaseEntityExtension,
  PluginExtensionConfig,
  ValidationExtension,
  StepComponent,
  StepValidation
} from './plugin-extension';

describe('ExtendingNodeTypeDefinition インターフェース', () => {
  
  beforeEach(() => {
    // 【テスト前準備】: 各テスト実行前にテスト環境を初期化し、一貫したテスト条件を保証
    // 【環境初期化】: 前のテストの影響を受けないよう、型システムの状態をクリーンにリセット
  });

  afterEach(() => {
    // 【テスト後処理】: テスト実行後に作成された一時的な型定義やモックを削除
    // 【状態復元】: 次のテストに影響しないよう、システムを元の状態に戻す
  });

  it('基本的なプラグイン拡張定義を作成できること', () => {
    // 【テスト目的】: ExtendingNodeTypeDefinition型が基本的なプラグイン拡張構造を表現できることを確認
    // 【テスト内容】: folderプラグインを拡張するstylemap定義を作成し、型安全性を検証
    // 【期待される動作】: 継承元プラグイン、追加ステップ、拡張エンティティが正しく定義される
    // 🟢 信頼性レベル: 設計文書に基づいた仕様

    // 【テストデータ準備】: StyleMapプラグインがFolderプラグインを拡張する想定
    // 【初期条件設定】: 拡張定義に必要な最小限のプロパティを設定
    const styleMapExtension: ExtendingNodeTypeDefinition<any, any, any> = {
      extends: 'folder',
      nodeType: 'stylemap',
      name: 'StyleMap',
      displayName: 'Style Map',
      extendedSteps: [
        {
          stepNumber: 2,
          title: 'File Upload',
          component: {} as StepComponent,
          validation: {} as StepValidation
        }
      ],
      extendedFields: [],
      extendedValidation: undefined
    };

    // 【実際の処理実行】: 型定義の検証
    // 【処理内容】: プラグイン拡張定義の必須プロパティを確認
    const result = styleMapExtension;

    // 【結果検証】: 拡張定義の構造が正しいことを確認
    // 【期待値確認】: extends, nodeType, extendedStepsが正しく設定されている
    expect(result.extends).toBe('folder'); // 【確認内容】: 基底プラグインがfolderであることを確認 🟢
    expect(result.nodeType).toBe('stylemap'); // 【確認内容】: 拡張プラグインのタイプがstylemapであることを確認 🟢
    expect(result.extendedSteps).toHaveLength(1); // 【確認内容】: 追加ステップが1つ定義されていることを確認 🟢
    expect(result.extendedSteps?.[0]?.stepNumber).toBe(2); // 【確認内容】: ステップ番号が2（基底の次）であることを確認 🟢
  });

  it('BaseNodeDefinition型が基底プラグインの共通フィールドを定義できること', () => {
    // 【テスト目的】: 基底プラグインが共通フィールドとバリデーションを定義できることを確認
    // 【テスト内容】: name, descriptionフィールドと基本バリデーションルールの定義
    // 【期待される動作】: 基底フィールドが型安全に定義され、継承可能な構造になる
    // 🟢 信頼性レベル: 設計文書の仕様に完全準拠

    // 【テストデータ準備】: folderプラグインの基底定義
    // 【初期条件設定】: name/descriptionの共通フィールドを定義
    const baseDefinition: BaseNodeDefinition<any> = {
      baseFields: ['name', 'description'],
      baseValidation: {
        namePattern: /^[^<>:"/\\|?*]+$/,
        nameMaxLength: 255,
        descriptionMaxLength: 1000,
        required: ['name']
      },
      baseDialog: {} as any // BaseDialogComponentのモック
    };

    // 【実際の処理実行】: 基底定義の検証
    // 【処理内容】: 共通フィールドとバリデーションルールを確認
    const result = baseDefinition;

    // 【結果検証】: 基底定義の構造が正しいことを確認
    // 【期待値確認】: baseFields, baseValidationが適切に定義されている
    expect(result.baseFields).toContain('name'); // 【確認内容】: nameフィールドが基底フィールドに含まれることを確認 🟢
    expect(result.baseFields).toContain('description'); // 【確認内容】: descriptionフィールドが基底フィールドに含まれることを確認 🟢
    expect(result.baseValidation.nameMaxLength).toBe(255); // 【確認内容】: 名前の最大長が255文字であることを確認 🟢
    expect(result.baseValidation.required).toContain('name'); // 【確認内容】: nameが必須フィールドであることを確認 🟢
  });

  it('DialogStepDefinition型が多段階ダイアログのステップを定義できること', () => {
    // 【テスト目的】: ダイアログステップの構造が正しく定義できることを確認
    // 【テスト内容】: ステップ番号、タイトル、コンポーネント、バリデーションを含む完全なステップ定義
    // 【期待される動作】: 各ステップが独立して定義され、順序と依存関係を持つ
    // 🟡 信頼性レベル: 設計文書から妥当に推測した仕様

    // 【テストデータ準備】: ファイルアップロードステップの定義
    // 【初期条件設定】: ステップ2としてファイルアップロード機能を追加
    const fileUploadStep: DialogStepDefinition = {
      stepNumber: 2,
      title: 'Upload CSV/TSV File',
      component: {} as StepComponent,
      validation: {
        validate: async (data: any) => {
          if (!data.file) return { isValid: false, errors: ['File is required'] };
          if (!data.file.name.match(/\.(csv|tsv)$/i)) {
            return { isValid: false, errors: ['File must be CSV or TSV format'] };
          }
          return { isValid: true, errors: [] };
        }
      },
      dependsOn: [1], // Step 1（基底のname/description）に依存
      isOptional: false,
      canSkip: false
    };

    // 【実際の処理実行】: ステップ定義の検証
    // 【処理内容】: ステップの必須プロパティと依存関係を確認
    const result = fileUploadStep;

    // 【結果検証】: ステップ定義が完全であることを確認
    // 【期待値確認】: ステップ番号、タイトル、バリデーション、依存関係が正しく設定されている
    expect(result.stepNumber).toBe(2); // 【確認内容】: ステップ番号が2であることを確認 🟢
    expect(result.title).toBe('Upload CSV/TSV File'); // 【確認内容】: ステップタイトルが正しいことを確認 🟢
    expect(result.dependsOn).toContain(1); // 【確認内容】: ステップ1に依存していることを確認 🟡
    expect(result.isOptional).toBe(false); // 【確認内容】: 必須ステップであることを確認 🟡
  });

  it('ExtendedFieldDefinition型が拡張フィールドを定義できること', () => {
    // 【テスト目的】: プラグインが独自のフィールドを追加定義できることを確認
    // 【テスト内容】: キーカラム、値カラムなどの拡張フィールドの定義
    // 【期待される動作】: 型安全な拡張フィールドの追加と検証ルールの適用
    // 🟡 信頼性レベル: StyleMap要件から推測した仕様

    // 【テストデータ準備】: StyleMap固有のフィールド定義
    // 【初期条件設定】: keyColumn, valueColumnフィールドを追加
    const extendedFields: ExtendedFieldDefinition[] = [
      {
        name: 'keyColumn',
        type: 'string',
        required: true,
        label: 'Key Column',
        description: 'Column to use as map key',
        validation: {
          pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
          maxLength: 100
        }
      },
      {
        name: 'valueColumn',
        type: 'string',
        required: true,
        label: 'Value Column',
        description: 'Column to use for color mapping',
        validation: {
          pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
          maxLength: 100
        }
      }
    ];

    // 【実際の処理実行】: 拡張フィールドの検証
    // 【処理内容】: フィールドの型と検証ルールを確認
    const result = extendedFields;

    // 【結果検証】: 拡張フィールドが正しく定義されていることを確認
    // 【期待値確認】: 各フィールドの名前、型、必須属性、検証ルールが適切
    expect(result).toHaveLength(2); // 【確認内容】: 2つの拡張フィールドが定義されていることを確認 🟡
    expect(result[0]?.name).toBe('keyColumn'); // 【確認内容】: keyColumnフィールドが定義されていることを確認 🟢
    expect(result[0]?.required).toBe(true); // 【確認内容】: keyColumnが必須フィールドであることを確認 🟢
    expect(result[1]?.name).toBe('valueColumn'); // 【確認内容】: valueColumnフィールドが定義されていることを確認 🟢
  });

  it('ExtensionMetadata型がプラグイン継承メタデータを保持できること', () => {
    // 【テスト目的】: プラグインの継承関係とバージョン互換性情報を管理できることを確認
    // 【テスト内容】: 継承チェーン、バージョン、互換性情報のメタデータ定義
    // 【期待される動作】: プラグイン間の依存関係と互換性が明確に定義される
    // 🟡 信頼性レベル: アーキテクチャ設計から推測した仕様

    // 【テストデータ準備】: StyleMapプラグインのメタデータ
    // 【初期条件設定】: 継承関係とバージョン情報を設定
    const metadata: ExtensionMetadata = {
      extends: 'folder',
      version: '1.0.0',
      compatibleWith: {
        folder: '^1.0.0'
      },
      inheritanceChain: ['folder', 'stylemap'],
      mergedSteps: [
        { from: 'folder', stepNumber: 1 },
        { from: 'stylemap', stepNumber: 2 },
        { from: 'stylemap', stepNumber: 3 }
      ],
      mergedFields: [
        { from: 'folder', fields: ['name', 'description'] },
        { from: 'stylemap', fields: ['keyColumn', 'valueColumn'] }
      ]
    };

    // 【実際の処理実行】: メタデータの検証
    // 【処理内容】: 継承関係とマージ情報を確認
    const result = metadata;

    // 【結果検証】: メタデータが完全であることを確認
    // 【期待値確認】: 継承チェーン、ステップマージ、フィールドマージが正しい
    expect(result.extends).toBe('folder'); // 【確認内容】: folderプラグインを継承していることを確認 🟢
    expect(result.inheritanceChain).toEqual(['folder', 'stylemap']); // 【確認内容】: 継承チェーンが正しいことを確認 🟡
    expect(result.mergedSteps).toHaveLength(3); // 【確認内容】: 3つのステップがマージされていることを確認 🟡
    expect(result.mergedFields).toHaveLength(2); // 【確認内容】: 2グループのフィールドがマージされていることを確認 🟡
  });

  it('BaseEntityExtension型がエンティティ拡張契約を定義できること', () => {
    // 【テスト目的】: エンティティハンドラーの拡張契約が正しく定義できることを確認
    // 【テスト内容】: getExtendedData, saveExtendedDataメソッドの定義
    // 【期待される動作】: 基底エンティティを拡張して追加データを管理できる
    // 🟢 信頼性レベル: 設計文書の仕様に準拠

    // 【テストデータ準備】: StyleMapEntityの拡張定義
    // 【初期条件設定】: エンティティ拡張メソッドを定義
    const entityExtension: BaseEntityExtension<any, any> = {
      getExtendedData: async (_nodeId: NodeId) => {
        // StyleMap固有のデータを取得
        return {
          keyColumn: 'country_code',
          valueColumn: 'population',
          colorRules: [],
          defaultStyle: {}
        };
      },
      saveExtendedData: async (nodeId: NodeId, _data: any) => {
        // StyleMap固有のデータを保存
        console.log(`Saving extended data for node ${nodeId}`);
      },
      beforeExtend: async (nodeId: NodeId) => {
        // 拡張前のフック
        console.log(`Before extending node ${nodeId}`);
      },
      afterExtend: async (nodeId: NodeId) => {
        // 拡張後のフック
        console.log(`After extending node ${nodeId}`);
      }
    };

    // 【実際の処理実行】: エンティティ拡張の検証
    // 【処理内容】: 必須メソッドと拡張フックの存在を確認
    const result = entityExtension;

    // 【結果検証】: エンティティ拡張契約が完全であることを確認
    // 【期待値確認】: 必須メソッドが定義され、型安全に呼び出し可能
    expect(typeof result.getExtendedData).toBe('function'); // 【確認内容】: getExtendedDataメソッドが定義されていることを確認 🟢
    expect(typeof result.saveExtendedData).toBe('function'); // 【確認内容】: saveExtendedDataメソッドが定義されていることを確認 🟢
    expect(typeof result.beforeExtend).toBe('function'); // 【確認内容】: beforeExtendフックが定義されていることを確認 🟡
    expect(typeof result.afterExtend).toBe('function'); // 【確認内容】: afterExtendフックが定義されていることを確認 🟡
  });

  it('ValidationExtension型がバリデーションルールを拡張できること', () => {
    // 【テスト目的】: プラグインが独自のバリデーションルールを追加できることを確認
    // 【テスト内容】: 基底バリデーションに追加ルールをチェーン
    // 【期待される動作】: 基底と拡張のバリデーションが順次適用される
    // 🟡 信頼性レベル: 一般的なバリデーションパターンから推測

    // 【テストデータ準備】: StyleMap固有のバリデーションルール
    // 【初期条件設定】: ファイル形式とカラム選択の検証を追加
    const validationExtension: ValidationExtension = {
      extendedRules: {
        fileFormat: {
          validate: (value: any) => {
            if (!value.file) return false;
            return /\.(csv|tsv)$/i.test(value.file.name);
          },
          message: 'File must be CSV or TSV format'
        },
        columnSelection: {
          validate: (value: any) => {
            return value.keyColumn !== value.valueColumn;
          },
          message: 'Key column and value column must be different'
        }
      },
      chainMode: 'all', // all | stopOnFirst
      mergeStrategy: 'override' // override | append | prepend
    };

    // 【実際の処理実行】: バリデーション拡張の検証
    // 【処理内容】: 拡張ルールとマージ戦略を確認
    const result = validationExtension;

    // 【結果検証】: バリデーション拡張が正しく定義されていることを確認
    // 【期待値確認】: 拡張ルール、チェーンモード、マージ戦略が適切
    expect(Object.keys(result.extendedRules)).toContain('fileFormat'); // 【確認内容】: ファイル形式検証ルールが定義されていることを確認 🟡
    expect(Object.keys(result.extendedRules)).toContain('columnSelection'); // 【確認内容】: カラム選択検証ルールが定義されていることを確認 🟡
    expect(result.chainMode).toBe('all'); // 【確認内容】: 全てのルールを適用するモードであることを確認 🟡
    expect(result.mergeStrategy).toBe('override'); // 【確認内容】: 基底ルールをオーバーライドする戦略であることを確認 🟡
  });

  it('PluginExtensionConfig型が完全な拡張設定を定義できること', () => {
    // 【テスト目的】: プラグイン拡張の完全な設定構造を定義できることを確認
    // 【テスト内容】: 基底プラグイン、拡張ステップ、フィールド、ハンドラー全体の設定
    // 【期待される動作】: 拡張プラグインの全要素が統合された設定となる
    // 🟢 信頼性レベル: 設計文書の完全な仕様

    // 【テストデータ準備】: StyleMapプラグインの完全な拡張設定
    // 【初期条件設定】: 全ての拡張要素を含む設定を構築
    const extensionConfig: PluginExtensionConfig = {
      basePlugin: 'folder',
      extendedPlugin: 'stylemap',
      steps: {
        inherited: [
          { stepNumber: 1, from: 'folder', override: false }
        ],
        extended: [
          { stepNumber: 2, title: 'File Upload', component: {} as any },
          { stepNumber: 3, title: 'Column Selection', component: {} as any },
          { stepNumber: 4, title: 'Color Mapping', component: {} as any }
        ]
      },
      fields: {
        inherited: ['name', 'description'],
        extended: ['keyColumn', 'valueColumn', 'colorRules', 'defaultStyle']
      },
      handlers: {
        base: {} as any,
        extended: {} as any
      },
      validation: {
        base: {} as any,
        extended: {} as any
      },
      lifecycle: {
        beforeCreate: async () => {},
        afterCreate: async () => {},
        beforeUpdate: async () => {},
        afterUpdate: async () => {}
      }
    };

    // 【実際の処理実行】: 完全な拡張設定の検証
    // 【処理内容】: 全ての拡張要素が統合されていることを確認
    const result = extensionConfig;

    // 【結果検証】: 拡張設定が完全であることを確認
    // 【期待値確認】: 基底、ステップ、フィールド、ハンドラー、ライフサイクルが全て定義されている
    expect(result.basePlugin).toBe('folder'); // 【確認内容】: 基底プラグインがfolderであることを確認 🟢
    expect(result.extendedPlugin).toBe('stylemap'); // 【確認内容】: 拡張プラグインがstylemapであることを確認 🟢
    expect(result.steps.inherited).toHaveLength(1); // 【確認内容】: 1つのステップが継承されていることを確認 🟢
    expect(result.steps.extended).toHaveLength(3); // 【確認内容】: 3つのステップが拡張されていることを確認 🟢
    expect(result.fields.inherited).toContain('name'); // 【確認内容】: nameフィールドが継承されていることを確認 🟢
    expect(result.fields.extended).toContain('keyColumn'); // 【確認内容】: keyColumnフィールドが拡張されていることを確認 🟢
  });

  it('循環依存を検出できること', () => {
    // 【テスト目的】: プラグイン間の循環依存を検出できることを確認
    // 【テスト内容】: A→B→C→Aのような循環参照のケース
    // 【期待される動作】: 循環依存が検出され、適切なエラーが発生する
    // 🔴 信頼性レベル: エラーハンドリングの推測実装

    // 【テストデータ準備】: 循環依存を持つプラグイン定義
    // 【初期条件設定】: pluginA → pluginB → pluginC → pluginAの循環
    const detectCircularDependency = (config: any) => {
      const visited = new Set<string>();
      const recursionStack = new Set<string>();
      
      const hasCycle = (plugin: string): boolean => {
        visited.add(plugin);
        recursionStack.add(plugin);
        
        const extension = config[plugin];
        if (extension?.extends) {
          if (!visited.has(extension.extends)) {
            if (hasCycle(extension.extends)) return true;
          } else if (recursionStack.has(extension.extends)) {
            return true;
          }
        }
        
        recursionStack.delete(plugin);
        return false;
      };
      
      return hasCycle;
    };

    const circularConfig = {
      pluginA: { extends: 'pluginC' },
      pluginB: { extends: 'pluginA' },
      pluginC: { extends: 'pluginB' }
    };

    // 【実際の処理実行】: 循環依存の検出
    // 【処理内容】: プラグイン定義グラフを走査して循環を検出
    const hasCircular = detectCircularDependency(circularConfig)('pluginA');

    // 【結果検証】: 循環依存が検出されることを確認
    // 【期待値確認】: 循環が存在する場合trueが返される
    expect(hasCircular).toBe(true); // 【確認内容】: 循環依存が正しく検出されることを確認 🔴
  });

  it('プラグインの継承チェーンを構築できること', () => {
    // 【テスト目的】: プラグインの継承関係から完全な継承チェーンを構築できることを確認
    // 【テスト内容】: base → folder-plugin → stylemapのような継承チェーンの構築
    // 【期待される動作】: ルートから現在のプラグインまでの完全なパスが取得できる
    // 🟡 信頼性レベル: 設計から推測した実装

    // 【テストデータ準備】: 3層の継承関係を持つプラグイン
    // 【初期条件設定】: base → folder-plugin → stylemap-plugin の継承チェーン
    const buildInheritanceChain = (pluginName: string, registry: Map<string, any>): string[] => {
      const chain: string[] = [];
      let current = pluginName;
      
      while (current) {
        chain.unshift(current);
        const definition = registry.get(current);
        current = definition?.extends;
      }
      
      return chain;
    };

    const registry = new Map([
      ['base', { nodeType: 'base' }],
      ['folder', { nodeType: 'folder', extends: 'base' }],
      ['stylemap', { nodeType: 'stylemap', extends: 'folder' }]
    ]);

    // 【実際の処理実行】: 継承チェーンの構築
    // 【処理内容】: stylemapから基底までの継承チェーンを構築
    const chain = buildInheritanceChain('stylemap', registry);

    // 【結果検証】: 継承チェーンが正しく構築されることを確認
    // 【期待値確認】: base → folder-plugin → stylemap-plugin の順序でチェーンが構築される
    expect(chain).toEqual(['base', 'folder', 'stylemap']); // 【確認内容】: 継承チェーンが正しい順序で構築されることを確認 🟡
    expect(chain).toHaveLength(3); // 【確認内容】: 3層の継承関係が正しく認識されることを確認 🟡
  });
});