/**
 * @file NodeTypeAPI.test.ts
 * @description NodeTypeAPI のテストケース集
 *
 * TDD Redフェーズ: 新しいNodeTypeAPI仕様に基づく失敗するテストを作成
 */
import { expect, describe, it, beforeEach, afterEach, test } from 'vitest';
import { NodeTypeAPI } from '../src/NodeTypeAPI';
import { NodeType, NodeId, ValidationResult } from '@hierarchidb/common-type';

describe('NodeTypeAPI', () => {
  let nodeTypeAPI: NodeTypeAPI;

  beforeEach(() => {
    // 【テスト前準備】: 各テスト実行前にNodeTypeAPI実装のモックを初期化
    // 【環境初期化】: テスト間の状態を独立させ、一貫したテスト結果を保証
    nodeTypeAPI = {} as NodeTypeAPI; // モック実装（実装時に適切なインスタンス化が必要）
  });

  afterEach(() => {
    // 【テスト後処理】: テスト実行後の状態をクリーンアップ
    // 【状態復元】: 次のテストに影響しないよう、リソースを解放
    nodeTypeAPI = null as any;
  });

  describe('listSupported', () => {
    test('全てのサポートされているノード型のリストを返す', async () => {
      // 【テスト目的】: NodeTypeAPIが利用可能な全てのノード型を正しく取得できることを確認
      // 【テスト内容】: listSupported()メソッドが期待されるノード型の配列を返すかをテスト
      // 【期待される動作】: ['folder-plugin', 'document', 'basemap', 'project', 'shape-plugin']のような配列が返される
      // 🟢 信頼性レベル: API仕様書に明確に記載されているメソッドに基づく

      // 【テストデータ準備】: 特別な準備は不要（システム全体の状態を使用）
      // 【初期条件設定】: プラグインが正常に登録されている状態を前提

      // 【実際の処理実行】: listSupported()メソッドを呼び出して、サポートされるノード型を取得
      // 【処理内容】: 内部的に登録されているプラグインからノード型一覧を収集
      const supportedTypes = await nodeTypeAPI.listSupported();

      // 【結果検証】: 返されるデータの型と内容を確認
      // 【期待値確認】: 配列形式で複数のノード型が含まれることを確認
      expect(Array.isArray(supportedTypes)).toBe(true); // 【確認内容】: 戻り値が配列であることを確認 🟢
      expect(supportedTypes.length).toBeGreaterThan(0); // 【確認内容】: 少なくとも1つのノード型が登録されていることを確認 🟢
      expect(supportedTypes).toContain('folder'); // 【確認内容】: デフォルトのfolderノード型が含まれることを確認 🟢
    });

    test('空のシステムでは空配列を返す', async () => {
      // 【テスト目的】: プラグインが登録されていない状態での動作を確認
      // 【テスト内容】: プラグインが1つも登録されていない場合の挙動をテスト
      // 【期待される動作】: 空の配列[]が返される
      // 🟡 信頼性レベル: 一般的なAPIの期待動作に基づく合理的な推測

      // 【テストデータ準備】: プラグインが登録されていない状態を模擬
      // 【初期条件設定】: クリーンなシステム状態（プラグイン登録なし）

      // 【実際の処理実行】: 空のシステムでlistSupported()を実行
      // 【処理内容】: プラグインレジストリが空の状態での型一覧取得
      const supportedTypes = await nodeTypeAPI.listSupported();

      // 【結果検証】: 空配列が返されることを確認
      // 【期待値確認】: プラグインが無い場合は空配列を返すべき
      expect(supportedTypes).toEqual([]); // 【確認内容】: 空配列が返されることを確認 🟡
    });
  });

  describe('isSupported', () => {
    test('存在するノード型に対してtrueを返す', async () => {
      // 【テスト目的】: 登録されているノード型の存在確認が正しく動作することを検証
      // 【テスト内容】: isSupported()メソッドが既知のノード型に対してtrueを返すかをテスト
      // 【期待される動作】: 'folder-plugin'のような登録済みノード型に対してtrueが返される
      // 🟢 信頼性レベル: API仕様書で明確に定義されているメソッドの基本動作

      // 【テストデータ準備】: 既知の存在するノード型を指定
      // 【初期条件設定】: folderプラグインが登録されている状態
      const existingNodeType: NodeType = 'folder';

      // 【実際の処理実行】: 存在するノード型でisSupported()を実行
      // 【処理内容】: プラグインレジストリから指定されたノード型の存在を確認
      const isSupported = await nodeTypeAPI.isSupported(existingNodeType);

      // 【結果検証】: trueが返されることを確認
      // 【期待値確認】: 登録されているノード型は存在すると判定されるべき
      expect(isSupported).toBe(true); // 【確認内容】: 存在するノード型に対してtrueが返されることを確認 🟢
    });

    test('存在しないノード型に対してfalseを返す', async () => {
      // 【テスト目的】: 未登録のノード型の存在確認が正しく動作することを検証
      // 【テスト内容】: isSupported()メソッドが未知のノード型に対してfalseを返すかをテスト
      // 【期待される動作】: 'non-existent-type'のような未登録ノード型に対してfalseが返される
      // 🟢 信頼性レベル: API仕様書で明確に定義されているメソッドの基本動作

      // 【テストデータ準備】: 存在しないノード型を指定
      // 【初期条件設定】: 指定するノード型がシステムに登録されていない状態
      const nonExistentNodeType: NodeType = 'non-existent-type' as NodeType;

      // 【実際の処理実行】: 存在しないノード型でisSupported()を実行
      // 【処理内容】: プラグインレジストリで指定されたノード型の存在を確認し、見つからない場合の処理
      const isSupported = await nodeTypeAPI.isSupported(nonExistentNodeType);

      // 【結果検証】: falseが返されることを確認
      // 【期待値確認】: 未登録のノード型は存在しないと判定されるべき
      expect(isSupported).toBe(false); // 【確認内容】: 存在しないノード型に対してfalseが返されることを確認 🟢
    });
  });

  describe('validateOperation', () => {
    test('有効なノード型とオペレーションの組み合わせでバリデーション成功', async () => {
      // 【テスト目的】: ノード型とオペレーションの組み合わせのバリデーションが正しく動作することを確認
      // 【テスト内容】: validateOperation()メソッドが有効な組み合わせに対して成功結果を返すかをテスト
      // 【期待される動作】: {valid: true, errors: []}のような成功を示すValidationResultが返される
      // 🟢 信頼性レベル: API仕様書に定義されているvalidateOperationメソッドに基づく

      // 【テストデータ準備】: 有効なノード型とオペレーション、コンテキストを準備
      // 【初期条件設定】: folderノード型が登録されており、createオペレーションが可能な状態
      const nodeType: NodeType = 'folder';
      const operation: 'create' | 'update' | 'delete' | 'move' = 'create';
      const context = { parentId: 'parent-123' as NodeId };

      // 【実際の処理実行】: 有効な組み合わせでvalidateOperation()を実行
      // 【処理内容】: ノード型の登録状況とオペレーション許可状況を総合的に判定
      const result = await nodeTypeAPI.validateOperation(nodeType, operation, context);

      // 【結果検証】: バリデーション成功の結果を確認
      // 【期待値確認】: 有効な組み合わせではvalidがtrueでerrorsが空配列になるべき
      expect(result.valid).toBe(true); // 【確認内容】: バリデーション結果が成功であることを確認 🟢
      expect(result.errors).toEqual([]); // 【確認内容】: エラーが発生していないことを確認 🟢
    });

    test('無効なノード型でバリデーション失敗', async () => {
      // 【テスト目的】: 無効なノード型に対するバリデーション失敗が正しく動作することを確認
      // 【テスト内容】: validateOperation()メソッドが未登録のノード型に対して失敗結果を返すかをテスト
      // 【期待される動作】: {valid: false, errors: ['Node type invalid-type is not registered']}のような失敗結果が返される
      // 🟢 信頼性レベル: API仕様書に定義されているvalidateOperationメソッドの期待動作

      // 【テストデータ準備】: 無効なノード型を指定
      // 【初期条件設定】: 指定するノード型がシステムに登録されていない状態
      const invalidNodeType: NodeType = 'invalid-type' as NodeType;
      const operation: 'create' | 'update' | 'delete' | 'move' = 'create';

      // 【実際の処理実行】: 無効なノード型でvalidateOperation()を実行
      // 【処理内容】: ノード型の存在確認を行い、存在しない場合はエラーを生成
      const result = await nodeTypeAPI.validateOperation(invalidNodeType, operation);

      // 【結果検証】: バリデーション失敗の結果を確認
      // 【期待値確認】: 無効なノード型ではvalidがfalseでエラーメッセージが含まれるべき
      expect(result.valid).toBe(false); // 【確認内容】: バリデーション結果が失敗であることを確認 🟢
      expect(result.errors).toContain(`Node type ${invalidNodeType} is not registered`); // 【確認内容】: 適切なエラーメッセージが含まれることを確認 🟢
    });
  });

  describe('getSupportedOperations', () => {
    test('ノード型でサポートされている操作の配列を返す', async () => {
      // 【テスト目的】: ノード型がサポートする操作一覧を正しく取得できることを確認
      // 【テスト内容】: getSupportedOperations()メソッドが指定されたノード型の利用可能操作を返すかをテスト
      // 【期待される動作】: ['create', 'read', 'update', 'delete', 'move']のような操作配列が返される
      // 🟢 信頼性レベル: API仕様書に定義されているgetSupportedOperationsメソッドに基づく

      // 【テストデータ準備】: 既知のノード型を指定
      // 【初期条件設定】: folderノード型が登録されている状態
      const nodeType: NodeType = 'folder';

      // 【実際の処理実行】: getSupportedOperations()でサポート操作一覧を取得
      // 【処理内容】: 指定されたノード型の定義からサポートされる操作を抽出
      const operations = await nodeTypeAPI.getSupportedOperations(nodeType);

      // 【結果検証】: 操作配列の内容と型を確認
      // 【期待値確認】: 基本的なCRUD操作とmove操作がサポートされているべき
      expect(Array.isArray(operations)).toBe(true); // 【確認内容】: 戻り値が配列であることを確認 🟢
      expect(operations).toContain('create'); // 【確認内容】: create操作がサポートされることを確認 🟢
      expect(operations).toContain('read'); // 【確認内容】: read操作がサポートされることを確認 🟢
      expect(operations).toContain('update'); // 【確認内容】: update操作がサポートされることを確認 🟢
      expect(operations).toContain('delete'); // 【確認内容】: delete操作がサポートされることを確認 🟢
    });
  });

  describe('supportsChildren', () => {
    test('子要素をサポートするノード型でtrueを返す', async () => {
      // 【テスト目的】: ノード型の子要素サポート機能の確認が正しく動作することを検証
      // 【テスト内容】: supportsChildren()メソッドが子要素を持てるノード型に対してtrueを返すかをテスト
      // 【期待される動作】: folderのようなコンテナ型ノードに対してtrueが返される
      // 🟢 信頼性レベル: API仕様書に定義されているsupportsChildrenメソッドに基づく

      // 【テストデータ準備】: 子要素をサポートするノード型を指定
      // 【初期条件設定】: folderノード型が子要素サポートありで登録されている状態
      const containerNodeType: NodeType = 'folder';

      // 【実際の処理実行】: supportsChildren()で子要素サポート状況を確認
      // 【処理内容】: ノード型定義から子要素サポート可否を判定
      const supportsChildren = await nodeTypeAPI.supportsChildren(containerNodeType);

      // 【結果検証】: 子要素サポート状況を確認
      // 【期待値確認】: folderのようなコンテナ型は子要素をサポートするべき
      expect(supportsChildren).toBe(true); // 【確認内容】: 子要素をサポートするノード型でtrueが返されることを確認 🟢
    });
  });

  describe('getAllowedChildTypes', () => {
    test('親ノード型に対して許可された子ノード型の配列を返す', async () => {
      // 【テスト目的】: 親子関係の制約が正しく管理されていることを確認
      // 【テスト内容】: getAllowedChildTypes()メソッドが指定された親ノード型に対する有効な子ノード型を返すかをテスト
      // 【期待される動作】: folderの子として['folder-plugin', 'document', 'project']のような配列が返される
      // 🟡 信頼性レベル: API仕様書の記載内容から、一般的な階層構造の制約に基づく推測

      // 【テストデータ準備】: 親ノード型を指定
      // 【初期条件設定】: folderノード型が登録されており、子ノード型との関係が定義されている状態
      const parentType: NodeType = 'folder';

      // 【実際の処理実行】: getAllowedChildTypes()で許可された子ノード型を取得
      // 【処理内容】: 親ノード型の制約定義から許可される子ノード型一覧を抽出
      const allowedChildTypes = await nodeTypeAPI.getAllowedChildTypes(parentType);

      // 【結果検証】: 許可された子ノード型の配列内容を確認
      // 【期待値確認】: 少なくとも基本的なノード型が子として許可されるべき
      expect(Array.isArray(allowedChildTypes)).toBe(true); // 【確認内容】: 戻り値が配列であることを確認 🟢
      expect(allowedChildTypes.length).toBeGreaterThan(0); // 【確認内容】: 少なくとも1つの子ノード型が許可されることを確認 🟡
    });
  });

  describe('hasCapability', () => {
    test('ノード型が指定された機能を持つ場合にtrueを返す', async () => {
      // 【テスト目的】: ノード型の機能確認メソッドが正しく動作することを検証
      // 【テスト内容】: hasCapability()メソッドが指定されたノード型の機能を正確に判定するかをテスト
      // 【期待される動作】: folderノード型が'create'機能を持つ場合にtrueが返される
      // 🟡 信頼性レベル: API仕様書に記載されているが、具体的な機能名は一般的な推測に基づく

      // 【テストデータ準備】: ノード型と機能名を指定
      // 【初期条件設定】: folderノード型がcreate機能を持つよう登録されている状態
      const nodeType: NodeType = 'folder';
      const capability = 'create';

      // 【実際の処理実行】: hasCapability()で指定機能の有無を確認
      // 【処理内容】: ノード型定義から指定された機能の実装状況を判定
      const hasCapability = await nodeTypeAPI.hasCapability(nodeType, capability);

      // 【結果検証】: 機能の有無を確認
      // 【期待値確認】: folderノード型は基本的なcreate機能を持つべき
      expect(hasCapability).toBe(true); // 【確認内容】: 指定された機能を持つノード型でtrueが返されることを確認 🟡
    });

    test('ノード型が指定された機能を持たない場合にfalseを返す', async () => {
      // 【テスト目的】: ノード型の機能不保持の判定が正しく動作することを検証
      // 【テスト内容】: hasCapability()メソッドがノード型に無い機能に対してfalseを返すかをテスト
      // 【期待される動作】: 'non-existent-capability'のような無い機能に対してfalseが返される
      // 🟡 信頼性レベル: 一般的なAPIの期待動作に基づく合理的な推測

      // 【テストデータ準備】: ノード型と存在しない機能名を指定
      // 【初期条件設定】: folderノード型が登録されているが、指定機能は持たない状態
      const nodeType: NodeType = 'folder';
      const nonExistentCapability = 'non-existent-capability';

      // 【実際の処理実行】: hasCapability()で存在しない機能の有無を確認
      // 【処理内容】: ノード型定義から指定された機能を検索し、見つからない場合の処理
      const hasCapability = await nodeTypeAPI.hasCapability(nodeType, nonExistentCapability);

      // 【結果検証】: 機能の不在を確認
      // 【期待値確認】: 存在しない機能に対してはfalseが返されるべき
      expect(hasCapability).toBe(false); // 【確認内容】: 存在しない機能に対してfalseが返されることを確認 🟡
    });
  });
});
