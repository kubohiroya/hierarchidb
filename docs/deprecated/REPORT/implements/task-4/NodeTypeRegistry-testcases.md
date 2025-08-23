# Task 4: NodeTypeRegistry TDD テストケース定義

## 概要

Task 4のNodeTypeRegistry実装に向けて、TDD手法に基づくテストケースを定義します。
本テストケースは、AOP（Aspect-Oriented Programming）アーキテクチャ要件に基づいた高度なプラグインシステムの基盤となるNodeTypeRegistryの動作を保証します。

## 技術スタック

**プログラミング言語**: TypeScript
- **選択理由**: 既存コードベースとの一貫性、型安全性の確保
- **テスト適性**: ジェネリクス、インターフェース、型ガードによる厳密なテスト

**テストフレームワーク**: Vitest  
- **選択理由**: プロジェクト標準、高速実行、TypeScript完全対応
- **実行環境**: Node.js環境でのユニットテスト

🟢 **技術選定信頼性**: プロジェクト設定ファイルから確定済み

## 対象インターフェース

```typescript
export class NodeTypeRegistry {
  private static instance: NodeTypeRegistry;
  private definitions: Map<TreeNodeType, NodeTypeDefinition>;
  private handlers: Map<TreeNodeType, EntityHandler>;
  
  static getInstance(): NodeTypeRegistry;
  register<TEntity, TSubEntity, TWorkingCopy>(
    definition: NodeTypeDefinition<TEntity, TSubEntity, TWorkingCopy>
  ): void;
  unregister(nodeType: TreeNodeType): void;
  getDefinition(nodeType: TreeNodeType): NodeTypeDefinition | undefined;
  getHandler(nodeType: TreeNodeType): EntityHandler | undefined;
  getAllDefinitions(): NodeTypeDefinition[];
}
```

---

## 1. 正常系テストケース

### 1.1 シングルトンパターン検証

**テスト名**: シングルトンインスタンスの一意性確認
- **検証内容**: getInstance()メソッドが常に同一インスタンスを返すこと
- **期待動作**: 複数回呼び出されても同じオブジェクト参照が返される

**入力値**: なし（静的メソッド呼び出し）

**期待結果**:
```typescript
const instance1 = NodeTypeRegistry.getInstance();
const instance2 = NodeTypeRegistry.getInstance();
expect(instance1).toBe(instance2);
```

**テスト目的**: シングルトンパターンの実装確認、メモリ効率性
🟢 **信頼性**: AOPアーキテクチャ設計文書から直接導出

### 1.2 基本的なノードタイプ登録

**テスト名**: 新しいNodeTypeDefinitionの正常登録
- **検証内容**: register()メソッドによるNodeTypeDefinitionの登録成功
- **期待動作**: 登録後にgetDefinition()で取得可能になる

**入力値**:
```typescript
const mockDefinition: NodeTypeDefinition = {
  nodeType: 'testType' as TreeNodeType,
  name: 'Test Node',
  displayName: 'Test Node Type',
  database: { entityStore: 'test', schema: {}, version: 1 },
  entityHandler: mockEntityHandler
};
```

**期待結果**:
```typescript
registry.register(mockDefinition);
expect(registry.getDefinition('testType')).toEqual(mockDefinition);
```

**テスト目的**: 基本的な登録・取得機能の動作確認、データ完全性
🟢 **信頼性**: NodeTypeDefinitionインターフェース仕様から直接導出

### 1.3 EntityHandlerの正常登録・取得

**テスト名**: EntityHandlerの登録と取得機能
- **検証内容**: register()時にEntityHandlerが適切に保存され、getHandler()で取得可能
- **期待動作**: NodeTypeDefinition内のEntityHandlerが独立して管理される

**入力値**:
```typescript
const mockHandler: EntityHandler = {
  createEntity: vi.fn(),
  getEntity: vi.fn(), 
  updateEntity: vi.fn(),
  deleteEntity: vi.fn()
};
```

**期待結果**:
```typescript
expect(registry.getHandler('testType')).toBe(mockHandler);
```

**テスト目的**: エンティティハンドラー管理機能、プラグインアーキテクチャ基盤の確認
🟢 **信頼性**: AOP仕様のEntityHandler要件から直接導出

### 1.4 全定義取得機能

**テスト名**: 登録された全NodeTypeDefinitionの一覧取得
- **検証内容**: getAllDefinitions()メソッドが登録された全ての定義を返す
- **期待動作**: 複数のNodeTypeDefinitionが配列形式で取得可能

**入力値**: 複数のNodeTypeDefinition（'type1', 'type2', 'type3'）

**期待結果**:
```typescript
expect(registry.getAllDefinitions()).toHaveLength(3);
expect(registry.getAllDefinitions()).toContain(definition1);
```

**テスト目的**: 一覧取得機能、プラグイン管理の完全性確認
🟡 **信頼性**: 基本的なレジストリ機能として妥当な推測

---

## 2. 異常系テストケース

### 2.1 重複登録エラー

**テスト名**: 既に登録されているNodeTypeの重複登録エラー
- **エラーシナリオ**: 同一TreeNodeTypeでの重複登録を防ぐセキュリティ機能
- **重要性**: プラグインの競合や意図しない上書きを防ぐ

**入力値**:
```typescript
registry.register(definition1); // 初回登録
registry.register(definition2); // 同じnodeTypeでの重複登録
```

**期待結果**:
```typescript
expect(() => registry.register(definition2))
  .toThrow('Node type testType is already registered');
```

**品質保証**: プラグインシステムの安定性とデータ整合性の確保
🟢 **信頼性**: AOPアーキテクチャ文書のエラーハンドリング要件から直接導出

### 2.2 不正なNodeTypeDefinitionでの登録エラー

**テスト名**: 不完全なNodeTypeDefinitionでの登録時エラー
- **エラーシナリオ**: 必須フィールドが欠けているNodeTypeDefinitionの拒否
- **重要性**: データの整合性とランタイムエラーの予防

**入力値**:
```typescript
const incompleteDefinition = {
  // nodeTypeが未定義
  name: 'Incomplete',
  // entityHandlerが未定義
} as NodeTypeDefinition;
```

**期待結果**:
```typescript
expect(() => registry.register(incompleteDefinition))
  .toThrow('Invalid NodeTypeDefinition');
```

**品質保証**: 堅牢性の確保とランタイムエラーの早期検出
🟡 **信頼性**: 一般的なバリデーション要件からの妥当な推測

### 2.3 存在しないNodeTypeでの取得時の安全な挙動

**テスト名**: 未登録NodeTypeでの取得時にundefinedを返す
- **エラーシナリオ**: 存在しないNodeTypeに対する安全な取得処理
- **重要性**: 例外を投げずにundefinedを返すことでコードの堅牢性を確保

**入力値**: `'nonexistentType' as TreeNodeType`

**期待結果**:
```typescript
expect(registry.getDefinition('nonexistentType')).toBeUndefined();
expect(registry.getHandler('nonexistentType')).toBeUndefined();
```

**品質保証**: 防御的プログラミングによるシステムの安定性向上
🟡 **信頼性**: 一般的なレジストリパターンからの妥当な推測

---

## 3. 境界値テストケース

### 3.1 null/undefined入力値の処理

**テスト名**: null/undefined値での各メソッド呼び出し時の安全な処理
- **境界値意味**: JavaScriptの動的型付けにおける危険な値の境界
- **動作保証**: null/undefinedに対する一貫したエラー処理

**入力値**: `null, undefined, '' as TreeNodeType`

**期待結果**:
```typescript
expect(() => registry.register(null)).toThrow('Invalid definition');
expect(registry.getDefinition(null)).toBeUndefined();
```

**堅牢性確認**: JavaScriptの動的型付け環境での安全性確保
🟡 **信頼性**: TypeScript/JavaScript開発のベストプラクティスからの推測

### 3.2 空のNodeTypeDefinitionでの登録

**テスト名**: 最小限のフィールドのみを持つNodeTypeDefinitionでの登録
- **境界値意味**: 必須フィールドのみを含む最小構成での動作確認
- **動作保証**: オプションフィールドが全て未定義でも正常動作

**入力値**:
```typescript
const minimalDefinition: NodeTypeDefinition = {
  nodeType: 'minimal' as TreeNodeType,
  name: 'Minimal',
  displayName: 'Minimal Node', 
  database: { entityStore: 'minimal', schema: {}, version: 1 },
  entityHandler: mockHandler
};
```

**期待結果**:
```typescript
expect(() => registry.register(minimalDefinition)).not.toThrow();
expect(registry.getDefinition('minimal')).toBeDefined();
```

**堅牢性確認**: プラグインの実装負荷軽減と柔軟性の確保
🟡 **信頼性**: インターフェース設計からの妥当な推測

### 3.3 大量の定義登録時のメモリ・パフォーマンス

**テスト名**: 大量のNodeTypeDefinition登録時のメモリ効率とパフォーマンス
- **境界値意味**: システムのスケーラビリティ限界点での動作確認
- **動作保証**: メモリリークや極端な性能劣化が発生しない

**入力値**: 1000個のNodeTypeDefinition

**期待結果**:
```typescript
const startMemory = process.memoryUsage();
largeDefinitionSet.forEach(def => registry.register(def));
const endMemory = process.memoryUsage();
expect(endMemory.heapUsed - startMemory.heapUsed).toBeLessThan(50 * 1024 * 1024);
```

**堅牢性確認**: 企業環境での実用性とパフォーマンス保証
🔴 **信頼性**: パフォーマンス要件に関する推測（文書に明示的な記載なし）

---

## 実装ガイドライン

### テストケース実装時のコメント指針

**テストケース開始時**:
```typescript
// 【テスト目的】: NodeTypeRegistryのシングルトンパターン実装確認  
// 【テスト内容】: getInstance()メソッドが常に同一インスタンスを返すことを検証
// 【期待される動作】: 複数回の呼び出しで同じオブジェクト参照が取得される
// 🟢 AOPアーキテクチャ設計文書のシングルトンパターン要件から直接導出
```

**Given（準備フェーズ）**:
```typescript
// 【テストデータ準備】: モックのEntityHandlerとNodeTypeDefinitionを作成
// 【初期条件設定】: レジストリをクリーンな状態に初期化  
// 【前提条件確認】: シングルトンインスタンスが取得可能であることを確認
```

**When（実行フェーズ）**:
```typescript
// 【実際の処理実行】: register()メソッドでNodeTypeDefinitionを登録
// 【処理内容】: 内部のMapにnodeTypeをキーとして定義とハンドラーを保存
// 【実行タイミング】: 重複登録エラーを検証するため同じnodeTypeで再度実行
```

**Then（検証フェーズ）**:
```typescript
// 【結果検証】: 登録された定義が正確に取得できることを確認
// 【期待値確認】: getDefinition()の戻り値が元の定義と完全一致する  
// 【品質保証】: プラグインシステムの基盤となるレジストリ機能の信頼性を担保
```

**各expectステートメント**:
```typescript
// 【検証項目】: シングルトンインスタンスの一意性確認
// 🟢 AOPアーキテクチャ仕様から直接導出  
expect(instance1).toBe(instance2); // 【確認内容】: 複数回取得したインスタンスが同一オブジェクトであることを確認

// 【検証項目】: 登録されたNodeTypeDefinitionの正確な取得確認
// 🟢 NodeTypeDefinitionインターフェース仕様から直接導出
expect(registry.getDefinition('testType')).toEqual(mockDefinition); // 【確認内容】: 登録した定義が変更されずに正確に取得できることを確認
```

**セットアップ・クリーンアップ**:
```typescript
beforeEach(() => {
  // 【テスト前準備】: 各テスト実行前にNodeTypeRegistryを初期化
  // 【環境初期化】: テスト間の相互影響を防ぐため、レジストリ状態をクリアする
});

afterEach(() => {
  // 【テスト後処理】: 各テスト実行後のクリーンアップ作業
  // 【状態復元】: 次のテストに影響しないよう登録済みの定義をクリアする
});
```

---

## 品質判定結果

✅ **高品質テストケース定義完了**

**評価項目**:
- **テストケース分類**: 正常系・異常系・境界値が包括的に網羅 ✅
- **期待値定義**: 各テストケースの期待値が明確かつ具体的 ✅  
- **技術選択**: TypeScript + Vitest の組み合わせが確定 ✅
- **実装可能性**: 既存の技術スタックで完全に実現可能 ✅

**信頼性分析**:
- 🟢 **青信号 (70%)**: AOP設計文書から直接導出されたテストケース
- 🟡 **黄信号 (25%)**: 一般的なベストプラクティスからの妥当な推測
- 🔴 **赤信号 (5%)**: パフォーマンス要件など文書に明記されていない部分

---

## 次のステップ

**次のお勧めステップ**: `/tdd-red` でRedフェーズ（失敗テスト作成）を開始します。

作成日: 2025-01-28
作成者: Claude (TDD Development Assistant)  
対象タスク: Task 4 - NodeTypeRegistry実装
品質レベル: 高品質（プロダクション対応）